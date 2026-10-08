<?php

namespace App\Http\Requests;

use App\Services\ImageStorage;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Partial update: `sometimes` everywhere, so an omitted field keeps its stored
 * value and an explicit null clears it. `company_id` is not accepted at all.
 */
class UpdateBusRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:200'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],

            'features' => ['sometimes', 'nullable', 'array', 'max:50'],
            'features.*' => ['string', 'max:100'],

            'image' => ImageStorage::validationRules(optional: true),
            'remove_image' => ['sometimes', 'boolean'],

            'is_active' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.max' => __('messages.image_too_large'),
        ];
    }
}
