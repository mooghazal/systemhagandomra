<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Super-admin only. An owner cannot be moved to another company or demoted
 * here; there is no field for either.
 */
class UpdateOwnerRequest extends FormRequest
{
    public function rules(): array
    {
        $ownerId = $this->route('owner')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes', 'required', 'email:rfc', 'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at')->ignore($ownerId),
            ],
            'password' => ['sometimes', 'required', 'string', Password::defaults()],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
        }
    }
}
