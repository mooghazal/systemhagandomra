<?php

namespace App\Http\Resources;

use App\Models\Bus;
use App\Services\ImageStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Bus
 */
class BusResource extends JsonResource
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
            'type' => $this->type,
            'capacity' => $this->capacity,
            'model' => $this->model,
            'description' => $this->description,
            'features' => $this->features ?? [],
            'image_path' => $this->image_path,
            'image_url' => app(ImageStorage::class)->url($this->image_path),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
