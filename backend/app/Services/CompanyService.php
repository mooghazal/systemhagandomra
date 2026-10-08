<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Companies and their owner accounts.
 *
 * Every operation here is super-admin territory (enforced by CompanyPolicy):
 * creating a company and minting its first owner is the one place an `owner`
 * role is ever assigned.
 */
class CompanyService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly ImageStorage $images,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $query = Company::query()->withCount(['owners', 'employees', 'packages', 'hotels', 'buses']);

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
     * @param  array<string, mixed>|null  $owner  optional first owner account
     */
    public function create(array $data, ?array $owner = null, ?UploadedFile $logo = null): Company
    {
        return DB::transaction(function () use ($data, $owner, $logo) {
            $company = new Company;
            $company->fill([
                'name' => $data['name'],
                'domain' => $data['domain'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
            ]);
            $company->slug = $this->uniqueSlug($data['name']);
            $company->is_active = $data['is_active'] ?? true;

            if ($logo !== null) {
                $company->logo_path = $this->images->store($logo, 'companies');
            }

            $company->save();

            $this->audit->logModel('created', $company, ['name' => $company->name]);

            if ($owner !== null) {
                $this->createOwner($company, $owner);
            }

            return $company->fresh();
        });
    }

    /**
     * @param  array<string, mixed>  $data  already-validated input
     */
    public function update(
        Company $company,
        array $data,
        ?UploadedFile $logo = null,
        bool $removeLogo = false,
    ): Company {
        return DB::transaction(function () use ($company, $data, $logo, $removeLogo) {
            foreach (['name', 'domain', 'email', 'phone', 'address'] as $field) {
                if (array_key_exists($field, $data)) {
                    $company->{$field} = $data[$field];
                }
            }

            if (array_key_exists('is_active', $data) && $data['is_active'] !== null) {
                $company->is_active = (bool) $data['is_active'];
            }

            $previousLogo = $company->logo_path;

            if ($logo !== null) {
                $company->logo_path = $this->images->replace($previousLogo, $logo, 'companies');
            } elseif ($removeLogo) {
                $company->logo_path = null;
            }

            $changed = array_keys($company->getDirty());
            $company->save();

            if ($removeLogo && $logo === null) {
                $this->images->delete($previousLogo);
            }

            // Suspending a company is meant to stop it operating. Leaving its
            // staff with live tokens would stop only the login page.
            if (in_array('is_active', $changed, true) && ! $company->is_active) {
                $this->revokeTokensFor($company);
            }

            $this->audit->logModel('updated', $company, ['changed' => $changed]);

            return $company->fresh();
        });
    }

    /**
     * Soft delete, cascaded by hand.
     *
     * A database ON DELETE CASCADE only fires on a real DELETE, so soft
     * deleting the company alone would leave its users able to log in and its
     * packages visible to a super admin. Everything it owns is soft-deleted in
     * the same transaction.
     *
     * Nothing is destroyed: the company, its people and its content can all be
     * restored, and its slug and its users' e-mail addresses are released for
     * reuse immediately (see the generated columns in the migrations).
     */
    public function delete(Company $company): void
    {
        DB::transaction(function () use ($company) {
            $snapshot = [
                'name' => $company->name,
                'slug' => $company->slug,
                'users' => $company->users()->count(),
                'packages' => $company->packages()->count(),
                'hotels' => $company->hotels()->count(),
                'buses' => $company->buses()->count(),
            ];
            $id = $company->id;

            $company->packages()->delete();
            $company->hotels()->delete();
            $company->buses()->delete();
            $this->revokeTokensFor($company);
            $company->users()->delete();

            $company->delete();

            $this->audit->log(
                action: 'deleted',
                resourceType: 'company',
                resourceId: $id,
                metadata: $snapshot,
                companyId: $id,
            );
        });
    }

    /**
     * @param  array<string, mixed>  $data  already-validated input
     */
    public function createOwner(Company $company, array $data): User
    {
        // A company has exactly one owner (spec §3.2, §8). The schema enforces
        // this too, via the users_single_owner_per_company unique index; this
        // check exists so the caller gets a 422 explaining the rule rather than
        // a constraint violation.
        if ($company->owners()->exists()) {
            throw ValidationException::withMessages([
                'owner' => __('messages.company_has_owner'),
            ]);
        }

        return DB::transaction(function () use ($company, $data) {
            $owner = new User;
            $owner->fill([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'phone' => $data['phone'] ?? null,
            ]);

            $owner->role = UserRole::Owner;
            $owner->company_id = $company->id;
            $owner->is_active = $data['is_active'] ?? true;
            $owner->save();

            $this->audit->logModel('created', $owner, [
                'name' => $owner->name,
                'email' => $owner->email,
                'role' => UserRole::Owner->value,
            ]);

            return $owner;
        });
    }

    /**
     * @param  array<string, mixed>  $data  already-validated input
     */
    public function updateOwner(User $owner, array $data): User
    {
        return DB::transaction(function () use ($owner, $data) {
            foreach (['name', 'email', 'phone'] as $field) {
                if (array_key_exists($field, $data)) {
                    $owner->{$field} = $data[$field];
                }
            }

            if (! empty($data['password'])) {
                $owner->password = $data['password'];
            }

            if (array_key_exists('is_active', $data) && $data['is_active'] !== null) {
                $owner->is_active = (bool) $data['is_active'];
            }

            $changed = array_keys($owner->getDirty());
            $owner->save();

            // See EmployeeService::update — a changed password or a suspension
            // must close the sessions already open.
            if (array_intersect($changed, ['password', 'is_active']) !== []) {
                $owner->tokens()->delete();
            }

            $this->audit->logModel('updated', $owner, [
                'changed' => array_values(array_diff($changed, ['password'])),
                'password_changed' => in_array('password', $changed, true),
            ]);

            return $owner->fresh(['company']);
        });
    }

    public function deleteOwner(User $owner): void
    {
        DB::transaction(function () use ($owner) {
            $snapshot = ['name' => $owner->name, 'email' => $owner->email];
            $companyId = $owner->company_id;
            $id = $owner->id;

            $owner->delete();

            $this->audit->log(
                action: 'deleted',
                resourceType: 'user',
                resourceId: $id,
                metadata: $snapshot + ['role' => UserRole::Owner->value],
                companyId: $companyId,
            );
        });
    }

    /**
     * Ends every open session belonging to a company's people.
     *
     * Done in one query rather than per user: a company may have many staff,
     * and this runs inside the transaction that suspends or removes it.
     */
    private function revokeTokensFor(Company $company): void
    {
        \Laravel\Sanctum\PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->whereIn('tokenable_id', $company->users()->pluck('id'))
            ->delete();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'company';
        $slug = $base;
        $suffix = 2;

        while (Company::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
