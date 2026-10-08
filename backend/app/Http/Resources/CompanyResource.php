<?php

namespace App\Http\Resources;

use App\Models\Company;
use App\Services\ImageStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Company
 */
class CompanyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'domain' => $this->domain,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'logo_path' => $this->logo_path,
            'logo_url' => app(ImageStorage::class)->url($this->logo_path),
            'is_active' => $this->is_active,
            'counts' => $this->when(
                $this->owners_count !== null,
                fn () => [
                    'owners' => (int) $this->owners_count,
                    'employees' => (int) $this->employees_count,
                    'packages' => (int) $this->packages_count,
                    'hotels' => (int) $this->hotels_count,
                    'buses' => (int) $this->buses_count,
                ],
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
