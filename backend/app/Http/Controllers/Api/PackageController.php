<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePackageRequest;
use App\Http\Requests\UpdatePackageRequest;
use App\Http\Resources\PackageResource;
use App\Models\Package;
use App\Services\PackageService;
use App\Support\ApiResponse;
use App\Support\CsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
    /**
     * GET /api/packages/export
     *
     * The same rows the listing would show — same filters, same sort, same
     * tenant scope — without the paging.
     *
     * Gated on the permission that governs reading them rather than one of
     * its own: an export is a read, and anyone who can page through the
     * list can already copy it out by hand.
     */
    public function export(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Package::class);

        return CsvExport::stream(
            $this->packages->query($request->query()),
            [
                'الاسم' => 'name',
                'السعر' => 'price',
                'العملة' => 'currency',
                'عدد الأيام' => 'days',
                'نوع الرحلة' => 'trip_type',
                'الوجهة' => 'location',
                'تاريخ البداية' => 'start_date',
                'تاريخ النهاية' => 'end_date',
                'المزايا' => 'features',
                'نشطة' => 'is_active',
            ],
            'باقات-'.now()->format('Y-m-d').'.csv',
        );
    }
}
