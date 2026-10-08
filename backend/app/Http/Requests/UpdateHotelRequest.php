<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Partial update: `sometimes` everywhere, so an omitted field keeps its stored
 * value and an explicit null clears it. `company_id` is not accepted at all.
 */
class UpdateHotelRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],

            'distance_from_haram' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
            'distance_from_masjid_nabawi' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],

            'rating' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:5'],
            'room_type' => ['sometimes', 'nullable', 'string', 'max:255'],

            'features' => ['sometimes', 'nullable', 'array', 'max:50'],
            'features.*' => ['string', 'max:100'],

            'image' => ['sometimes', 'nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
            'remove_image' => ['sometimes', 'boolean'],

            'is_active' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.max' => __('messages.image_too_large'),
            'rating.max' => __('messages.rating_range'),
        ];
    }
}
