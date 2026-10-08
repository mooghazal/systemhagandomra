<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCompanyRequest;
use App\Http\Requests\UpdateCompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Services\CompanyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Companies — super-admin territory, enforced by CompanyPolicy (which denies
 * everyone except the super admins that Gate::before lets through first).
 *
 * The single exception is `show`, which a company's own users may call to read
 * their company record.
 */
class CompanyController extends Controller
{
    public function __construct(private readonly CompanyService $companies) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Company::class);

        $companies = $this->companies->paginate($request->query());

        return ApiResponse::paginated(CompanyResource::collection($companies));
    }

    public function store(StoreCompanyRequest $request): JsonResponse
    {
        $this->authorize('create', Company::class);

        $company = $this->companies->create(
            $request->safe()->except(['owner', 'logo']),
            $request->validated('owner'),
            $request->file('logo'),
        );

        return ApiResponse::created(CompanyResource::make($company));
    }

    public function show(Request $request, Company $company): JsonResponse
    {
        $this->authorize('view', $company);

        return ApiResponse::success(CompanyResource::make($company));
    }

    public function update(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        $this->authorize('update', $company);

        $company = $this->companies->update(
            $company,
            $request->safe()->except(['logo', 'remove_logo']),
            $request->file('logo'),
            $request->boolean('remove_logo'),
        );

        return ApiResponse::success(CompanyResource::make($company));
    }

    /**
     * Soft delete, cascaded in CompanyService to every user, package, hotel
     * and bus the company owns — a referential action never sees a soft
     * delete, so the service has to carry it.
     */
    public function destroy(Company $company): JsonResponse
    {
        $this->authorize('delete', $company);

        $this->companies->delete($company);

        return ApiResponse::success(null);
    }
}
