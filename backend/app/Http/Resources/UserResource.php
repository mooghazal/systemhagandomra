<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 *
 * The password hash, remember token and access tokens are absent by
 * construction: this resource lists what goes out, rather than removing what
 * must not. The same shape is returned to the admin panel, the company
 * dashboard and the MCP agent.
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'is_active' => $this->is_active,
            'company_id' => $this->company_id,
            // A super admin has no company, so the loaded relation is null;
            // CompanyResource::make(null) would then fail on its own fields.
            'company' => $this->whenLoaded(
                'company',
                fn () => $this->company ? CompanyResource::make($this->company) : null,
            ),
            'permissions' => $this->when(
                $this->relationLoaded('permissions'),
                fn () => $this->permissions->pluck('name')->sort()->values()->all(),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
