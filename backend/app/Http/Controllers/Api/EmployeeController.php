<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmployeeRequest;
use App\Http\Requests\SyncEmployeePermissionsRequest;
use App\Http\Requests\UpdateEmployeeRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\EmployeeService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Employee accounts.
 *
 * `{employee}` is bound through a scoped resolver (see AppServiceProvider),
 * so an id from another company — or an id belonging to an owner or super
 * admin — is a 404 and never reaches a policy.
 */
class EmployeeController extends Controller
{
    public function __construct(private readonly EmployeeService $employees) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $employees = $this->employees->paginate($request->query());

        return ApiResponse::paginated(UserResource::collection($employees));
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $permissions = $request->validated('permissions');

        // Creating an employee and granting them permissions are separate
        // privileges. Someone with `employees.create` alone gets an account
        // with no permissions, not a way to mint a fully-privileged colleague.
        if (! empty($permissions)) {
            $this->authorize('grantPermissions', User::class);
        }

        $employee = $this->employees->create($request->safe()->except('permissions'), $permissions);

        return ApiResponse::created(UserResource::make($employee));
    }

    public function show(Request $request, User $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        return ApiResponse::success(
            UserResource::make($employee->load(['company', 'permissions']))
        );
    }

    /**
     * Fields that control the account rather than describe the person.
     *
     * Each one, on its own, is a way to take a colleague's account: set their
     * password and sign in as them; re-point their e-mail and take any future
     * recovery; disable them and they are simply gone. None is a correction to
     * someone's details, so none belongs to `employees.update`.
     */
    private const CREDENTIAL_FIELDS = ['password', 'email', 'is_active'];

    public function update(UpdateEmployeeRequest $request, User $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $touchesCredentials = array_intersect(
            array_keys($request->validated()),
            self::CREDENTIAL_FIELDS,
        );

        // Checked against what the request actually carries, so editing a name
        // stays open to anyone holding `employees.update`.
        if ($touchesCredentials !== []) {
            $this->authorize('manageCredentials', $employee);
        }

        $employee = $this->employees->update($employee, $request->validated());

        return ApiResponse::success(UserResource::make($employee));
    }

    public function destroy(User $employee): JsonResponse
    {
        $this->authorize('delete', $employee);

        $this->employees->delete($employee);

        return ApiResponse::success(null);
    }

    /**
     * GET /api/employees/{employee}/permissions
     */
    public function permissions(Request $request, User $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        return ApiResponse::success([
            'permissions' => $employee->permissionNames()->sort()->values()->all(),
        ]);
    }

    /**
     * PUT /api/employees/{employee}/permissions
     *
     * Owner-level: replaces the whole set.
     */
    public function syncPermissions(SyncEmployeePermissionsRequest $request, User $employee): JsonResponse
    {
        $this->authorize('managePermissions', $employee);

        $employee = $this->employees->syncPermissions($employee, $request->permissionNames());

        return ApiResponse::success([
            'permissions' => $employee->permissions->pluck('name')->sort()->values()->all(),
        ]);
    }
}
