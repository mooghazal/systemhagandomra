<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\Permission;
use App\Models\User;
use App\Support\Permissions;
use App\Support\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Employee accounts and their permission grants.
 *
 * Three things are decided here and never taken from input:
 *   - `role`, which is always "employee" for accounts created through this
 *     service, so no caller can mint an owner or a super admin;
 *   - `company_id`, which comes from the authenticated context;
 *   - the permission set, which is intersected against the known permission
 *     list so an unknown or invented name cannot be stored.
 */
class EmployeeService
{
    public function __construct(
        private readonly TenantContext $tenant,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $query = User::query()->employees()->with(['company', 'permissions']);

        $companyId = $this->tenant->resolveCompanyIdForRead(
            isset($filters['company_id']) ? (int) $filters['company_id'] : null
        );

        if ($companyId !== null) {
            $query->ofCompany($companyId);
        }

        if (($search = trim((string) ($filters['search'] ?? ''))) !== '') {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $search);
            $query->where(function ($q) use ($escaped) {
                $q->where('name', 'like', "%{$escaped}%")
                    ->orWhere('email', 'like', "%{$escaped}%");
            });
        }

        if (array_key_exists('is_active', $filters) && $filters['is_active'] !== null) {
            $query->where('is_active', (bool) $filters['is_active']);
        }

        $perPage = min(max((int) ($filters['per_page'] ?? 15), 1), CompanyResourceService::MAX_PER_PAGE);

        return $query->orderByDesc('id')->paginate($perPage)->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data  already-validated input
     * @param  array<int, string>|null  $permissions  permission names, or null for none
     */
    public function create(array $data, ?array $permissions = null): User
    {
        $companyId = $this->tenant->resolveCompanyIdForWrite(
            isset($data['company_id']) ? (int) $data['company_id'] : null
        );

        return DB::transaction(function () use ($data, $permissions, $companyId) {
            $employee = new User;
            $employee->fill([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'phone' => $data['phone'] ?? null,
            ]);

            // Not fillable, and not read from $data: an employee created here
            // is an employee, in the caller's company, full stop.
            $employee->role = UserRole::Employee;
            $employee->company_id = $companyId;
            $employee->is_active = $data['is_active'] ?? true;

            $employee->save();

            if ($permissions !== null) {
                $this->applyPermissions($employee, $permissions);
            }

            $this->audit->logModel('created', $employee, [
                'name' => $employee->name,
                'email' => $employee->email,
                'permissions' => $employee->permissionNames()->all(),
            ]);

            return $employee->fresh(['company', 'permissions']);
        });
    }

    /**
     * @param  array<string, mixed>  $data  already-validated input
     */
    public function update(User $employee, array $data): User
    {
        $this->assertIsEmployee($employee);

        return DB::transaction(function () use ($employee, $data) {
            $employee->fill(array_filter([
                'name' => $data['name'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
            ], fn ($value) => $value !== null));

            // `phone` is nullable, so an explicit null must still be applied.
            if (array_key_exists('phone', $data)) {
                $employee->phone = $data['phone'];
            }

            if (! empty($data['password'])) {
                $employee->password = $data['password'];
            }

            if (array_key_exists('is_active', $data) && $data['is_active'] !== null) {
                $employee->is_active = (bool) $data['is_active'];
            }

            $changed = array_keys($employee->getDirty());
            $employee->save();

            /*
             * A new password, or a suspension, has to end the sessions that are
             * already open — otherwise "reset their password" leaves whoever
             * took the account still signed in, which is precisely the moment
             * it matters most.
             */
            if (array_intersect($changed, ['password', 'is_active']) !== []) {
                $employee->tokens()->delete();
            }

            $this->audit->logModel('updated', $employee, [
                'changed' => array_values(array_diff($changed, ['password'])),
                'password_changed' => in_array('password', $changed, true),
            ]);

            return $employee->fresh(['company', 'permissions']);
        });
    }

    public function delete(User $employee): void
    {
        $this->assertIsEmployee($employee);

        DB::transaction(function () use ($employee) {
            $snapshot = ['name' => $employee->name, 'email' => $employee->email];
            $companyId = $employee->company_id;
            $id = $employee->id;

            $employee->delete();

            $this->audit->log(
                action: 'deleted',
                resourceType: 'user',
                resourceId: $id,
                metadata: $snapshot,
                companyId: $companyId,
            );
        });
    }

    /**
     * Replaces an employee's permission set.
     *
     * @param  array<int, string>  $permissionNames
     */
    public function syncPermissions(User $employee, array $permissionNames): User
    {
        $this->assertIsEmployee($employee);

        return DB::transaction(function () use ($employee, $permissionNames) {
            $before = $employee->permissionNames()->sort()->values()->all();

            $this->applyPermissions($employee, $permissionNames);

            $employee->load('permissions');
            $after = $employee->permissionNames()->sort()->values()->all();

            $this->audit->logModel('permissions_updated', $employee, [
                'before' => $before,
                'after' => $after,
            ]);

            return $employee->fresh(['company', 'permissions']);
        });
    }

    /**
     * @param  array<int, string>  $permissionNames
     */
    private function applyPermissions(User $employee, array $permissionNames): void
    {
        $unknown = array_diff($permissionNames, Permissions::all());

        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'permissions' => __('messages.unknown_permission', ['names' => implode(', ', $unknown)]),
            ]);
        }

        $ids = Permission::query()
            ->whereIn('name', $permissionNames)
            ->pluck('id')
            ->all();

        $employee->permissions()->sync($ids);
    }

    /**
     * Guards the employee endpoints against being pointed at an owner or a
     * super admin, which would otherwise let anyone holding `employees.update`
     * edit an account more privileged than their own.
     */
    private function assertIsEmployee(User $user): void
    {
        if ($user->role !== UserRole::Employee) {
            throw ValidationException::withMessages([
                'user' => __('messages.not_an_employee'),
            ]);
        }
    }
}
