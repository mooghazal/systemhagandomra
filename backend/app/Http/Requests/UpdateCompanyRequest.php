<?php

namespace App\Http\Requests;

use App\Services\ImageStorage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Super-admin only. `slug` stays immutable so existing references to a company
 * do not break.
 */
class UpdateCompanyRequest extends FormRequest
{
    public function rules(): array
    {
        $companyId = $this->route('company')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'domain' => [
                'sometimes', 'nullable', 'string', 'max:255',
                Rule::unique('companies', 'domain')->whereNull('deleted_at')->ignore($companyId),
            ],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'logo' => ImageStorage::validationRules(optional: true),
            'remove_logo' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
