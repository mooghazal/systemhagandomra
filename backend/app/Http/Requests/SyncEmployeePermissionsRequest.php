<?php

namespace App\Http\Requests;

use App\Support\Permissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Replaces an employee's permission set wholesale.
 *
 * `permissions` is required even when empty, so "revoke everything" is an
 * explicit `[]` rather than an omitted field that could be sent by accident.
 */
class SyncEmployeePermissionsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', Rule::in(Permissions::all())],
        ];
    }

    public function messages(): array
    {
        return [
            'permissions.present' => __('messages.permissions_present'),
            'permissions.*.in' => __('messages.permission_unknown'),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function permissionNames(): array
    {
        return array_values(array_unique($this->validated('permissions', [])));
    }
}
