<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreHotelRequest;
use App\Http\Requests\UpdateHotelRequest;
use App\Http\Resources\HotelResource;
use App\Models\Hotel;
use App\Services\HotelService;
use App\Support\ApiResponse;
use App\Support\CsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * See PackageController for the shape; HotelService holds the logic shared
 * with the MCP tools.
 */
class HotelController extends Controller
{
    public function __construct(private readonly HotelService $hotels) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Hotel::class);

        $hotels = $this->hotels->paginate($request->query());

        return ApiResponse::paginated(HotelResource::collection($hotels));
    }

    public function store(StoreHotelRequest $request): JsonResponse
    {
        $this->authorize('create', Hotel::class);

        $hotel = $this->hotels->create(
            $request->safe()->except('image'),
            $request->file('image'),
        );

        return ApiResponse::created(HotelResource::make($hotel));
    }

    public function show(Request $request, Hotel $hotel): JsonResponse
    {
        $this->authorize('view', $hotel);

        return ApiResponse::success(HotelResource::make($hotel->load('company')));
    }

    public function update(UpdateHotelRequest $request, Hotel $hotel): JsonResponse
    {
        $this->authorize('update', $hotel);

        $hotel = $this->hotels->update(
            $hotel,
            $request->safe()->except(['image', 'remove_image']),
            $request->file('image'),
            $request->boolean('remove_image'),
        );

        return ApiResponse::success(HotelResource::make($hotel));
    }

    public function destroy(Hotel $hotel): JsonResponse
    {
        $this->authorize('delete', $hotel);

        $this->hotels->delete($hotel);

        return ApiResponse::success(null);
    }
    /**
     * GET /api/hotels/export
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
        $this->authorize('viewAny', Hotel::class);

        return CsvExport::stream(
            $this->hotels->query($request->query()),
            [
                'الاسم' => 'name',
                'الموقع' => 'location',
                'التقييم' => 'rating',
                'المسافة من الحرم' => 'distance_from_haram',
                'المسافة من المسجد النبوي' => 'distance_from_masjid_nabawi',
                'نوع الغرفة' => 'room_type',
                'المزايا' => 'features',
                'نشط' => 'is_active',
            ],
            'فنادق-'.now()->format('Y-m-d').'.csv',
        );
    }
}
