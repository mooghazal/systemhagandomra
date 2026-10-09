<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBusRequest;
use App\Http\Requests\UpdateBusRequest;
use App\Http\Resources\BusResource;
use App\Models\Bus;
use App\Services\BusService;
use App\Support\ApiResponse;
use App\Support\CsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * See PackageController for the shape; BusService holds the logic shared with
 * the MCP tools.
 */
class BusController extends Controller
{
    public function __construct(private readonly BusService $buses) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Bus::class);

        $buses = $this->buses->paginate($request->query());

        return ApiResponse::paginated(BusResource::collection($buses));
    }

    public function store(StoreBusRequest $request): JsonResponse
    {
        $this->authorize('create', Bus::class);

        $bus = $this->buses->create(
            $request->safe()->except('image'),
            $request->file('image'),
        );

        return ApiResponse::created(BusResource::make($bus));
    }

    public function show(Request $request, Bus $bus): JsonResponse
    {
        $this->authorize('view', $bus);

        return ApiResponse::success(BusResource::make($bus->load('company')));
    }

    public function update(UpdateBusRequest $request, Bus $bus): JsonResponse
    {
        $this->authorize('update', $bus);

        $bus = $this->buses->update(
            $bus,
            $request->safe()->except(['image', 'remove_image']),
            $request->file('image'),
            $request->boolean('remove_image'),
        );

        return ApiResponse::success(BusResource::make($bus));
    }

    public function destroy(Bus $bus): JsonResponse
    {
        $this->authorize('delete', $bus);

        $this->buses->delete($bus);

        return ApiResponse::success(null);
    }
    /**
     * GET /api/buses/export
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
        $this->authorize('viewAny', Bus::class);

        return CsvExport::stream(
            $this->buses->query($request->query()),
            [
                'الاسم' => 'name',
                'النوع' => 'type',
                'السعة' => 'capacity',
                'الموديل' => 'model',
                'المزايا' => 'features',
                'نشطة' => 'is_active',
            ],
            'حافلات-'.now()->format('Y-m-d').'.csv',
        );
    }
}
