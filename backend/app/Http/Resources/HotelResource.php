<?php

namespace App\Http\Resources;

use App\Models\Hotel;
use App\Services\ImageStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Hotel
 */
class HotelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            // The relation resolves to null when the company has been
            // soft-deleted, which a super admin can still see. CompanyResource
            // would then dereference null and answer 500.
            'company' => $this->whenLoaded(
                'company',
                fn () => $this->company ? CompanyResource::make($this->company) : null,
            ),
            'name' => $this->name,
            'location' => $this->location,
            'description' => $this->description,
            'distance_from_haram' => $this->distance_from_haram,
            'distance_from_masjid_nabawi' => $this->distance_from_masjid_nabawi,
            'rating' => $this->rating,
            'room_type' => $this->room_type,
            'features' => $this->features ?? [],
            'image_path' => $this->image_path,
            'image_url' => app(ImageStorage::class)->url($this->image_path),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
