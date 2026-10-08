<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ResolvesCompanyInput;
use App\Services\ImageStorage;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Only `name` is required. A hotel in Makkah has no distance to Masjid
 * an-Nabawi and one in Madinah has no distance to the Haram, so both are
 * optional and neither is defaulted.
 */
class StoreHotelRequest extends FormRequest
{
    use ResolvesCompanyInput;

    public function rules(): array
    {
        return [
            'company_id' => $this->companyIdRules(),

            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],

            // Walking distance in metres.
            'distance_from_haram' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'distance_from_masjid_nabawi' => ['nullable', 'integer', 'min:0', 'max:100000'],

            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'room_type' => ['nullable', 'string', 'max:255'],

            'features' => ['nullable', 'array', 'max:50'],
            'features.*' => ['string', 'max:100'],

            'image' => ImageStorage::validationRules(),

            'is_active' => ['nullable', 'boolean'],
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
