<?php

namespace App\Http\Resources;

use App\Models\Package;
use App\Services\ImageStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Package
 */
class PackageResource extends JsonResource
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
            'description' => $this->description,

            // Null means "not priced", which is different from a price of
            // zero. Optional fields are passed through unchanged rather than
            // being coerced to a default.
            'price' => $this->price !== null ? (float) $this->price : null,
            'currency' => $this->currency,
            'days' => $this->days,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'trip_type' => $this->trip_type,
            'location' => $this->location,
            'features' => $this->features ?? [],
            'image_path' => $this->image_path,
            'image_url' => app(ImageStorage::class)->url($this->image_path),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
