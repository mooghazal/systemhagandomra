<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ResolvesCompanyInput;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Only `name` is required; a fleet entry may be recorded before its capacity,
 * model or type are known.
 */
class StoreBusRequest extends FormRequest
{
    use ResolvesCompanyInput;

    public function rules(): array
    {
        return [
            'company_id' => $this->companyIdRules(),

            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:200'],
            'model' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],

            'features' => ['nullable', 'array', 'max:50'],
            'features.*' => ['string', 'max:100'],

            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],

            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.max' => __('messages.image_too_large'),
        ];
    }
}
