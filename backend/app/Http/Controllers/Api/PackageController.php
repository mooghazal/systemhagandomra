<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePackageRequest;
use App\Http\Requests\UpdatePackageRequest;
use App\Http\Resources\PackageResource;
use App\Models\Package;
use App\Services\PackageService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Thin by design: authorise, validate, delegate, present.
 *
 * All of the business logic lives in PackageService, which the MCP tools call
 * directly — so an agent-driven change and a dashboard change cannot diverge.
 *
 * Route model binding resolves {package} through the tenant scope, so an id
 * belonging to another company is a 404 before any policy runs and the
 * existence of that record is never disclosed.
 */
class PackageController extends Controller
{
    public function __construct(private readonly PackageService $packages) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Package::class);

        $packages = $this->packages->paginate($request->query());

        return ApiResponse::paginated(PackageResource::collection($packages));
    }

    public function store(StorePackageRequest $request): JsonResponse
    {
        $this->authorize('create', Package::class);

        $package = $this->packages->create(
            $request->safe()->except('image'),
            $request->file('image'),
        );

        return ApiResponse::created(PackageResource::make($package));
    }

    public function show(Request $request, Package $package): JsonResponse
    {
        $this->authorize('view', $package);

        return ApiResponse::success(PackageResource::make($package->load('company')));
    }

    public function update(UpdatePackageRequest $request, Package $package): JsonResponse
    {
        $this->authorize('update', $package);

        $package = $this->packages->update(
            $package,
            $request->safe()->except(['image', 'remove_image']),
            $request->file('image'),
            $request->boolean('remove_image'),
        );

        return ApiResponse::success(PackageResource::make($package));
    }

    public function destroy(Package $package): JsonResponse
    {
        $this->authorize('delete', $package);

        $this->packages->delete($package);

        return ApiResponse::success(null);
    }
}
