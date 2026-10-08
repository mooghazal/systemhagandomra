<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOwnerRequest;
use App\Http\Requests\UpdateOwnerRequest;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Models\User;
use App\Services\CompanyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Owner accounts, nested under their company:
 * /api/companies/{company}/owners[/{owner}]
 *
 * Every action is gated on CompanyPolicy::manageOwners, which only a super
 * admin passes. This is the one place in the system that creates an account
 * with the `owner` role.
 */
class OwnerController extends Controller
{
    public function __construct(private readonly CompanyService $companies) {}

    /**
     * GET /api/owners — every owner in the system, for the admin panel's
     * owners screen. Super-admin only, like the rest of this controller.
     */
    public function all(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Company::class);

        $query = User::query()->owners()->with('company');

        if (($search = trim((string) $request->query('search', ''))) !== '') {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $search);
            $query->where(function ($q) use ($escaped) {
                $q->where('name', 'like', "%{$escaped}%")
                    ->orWhere('email', 'like', "%{$escaped}%");
            });
        }

        if ($request->filled('company_id')) {
            $query->ofCompany((int) $request->query('company_id'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        return ApiResponse::paginated(
            UserResource::collection($query->orderByDesc('id')->paginate($perPage)->withQueryString())
        );
    }

    public function index(Request $request, Company $company): JsonResponse
    {
        $this->authorize('manageOwners', $company);

        $owners = $company->owners()->with('company')->orderBy('id')->get();

        return ApiResponse::success(UserResource::collection($owners)->toArray($request));
    }

    public function store(StoreOwnerRequest $request, Company $company): JsonResponse
    {
        $this->authorize('manageOwners', $company);

        $owner = $this->companies->createOwner($company, $request->validated());

        return ApiResponse::created(UserResource::make($owner->load('company')));
    }

    public function update(UpdateOwnerRequest $request, Company $company, User $owner): JsonResponse
    {
        $this->authorize('manageOwners', $company);
        $this->assertBelongsTo($company, $owner);

        $owner = $this->companies->updateOwner($owner, $request->validated());

        return ApiResponse::success(UserResource::make($owner));
    }

    public function destroy(Company $company, User $owner): JsonResponse
    {
        $this->authorize('manageOwners', $company);
        $this->assertBelongsTo($company, $owner);

        $this->companies->deleteOwner($owner);

        return ApiResponse::success(null);
    }

    /**
     * Guards against /api/companies/1/owners/{id of an owner at company 2}.
     * The route binding resolves the owner independently of the company, so
     * the pairing has to be checked here.
     */
    private function assertBelongsTo(Company $company, User $owner): void
    {
        abort_unless($owner->company_id === $company->id, 404);
    }
}
