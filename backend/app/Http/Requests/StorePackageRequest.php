<?php

namespace App\Http\Requests;

use App\Enums\TripType;
use App\Http\Requests\Concerns\ResolvesCompanyInput;
use App\Services\ImageStorage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

/**
 * Only `name` is required.
 *
 * Every other field is `nullable`, because a package may legitimately have no
 * price, no duration, no dates or no features. Nothing is given a fallback
 * value here: an absent field stays absent and a null stays null.
 */
class StorePackageRequest extends FormRequest
{
    use ResolvesCompanyInput;

    public function rules(): array
    {
        return [
            'company_id' => $this->companyIdRules(),

            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],

            'price' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'currency' => ['nullable', 'string', 'size:3', 'alpha'],

            'days' => ['nullable', 'integer', 'min:1', 'max:365'],

            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],

            'trip_type' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:255'],

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
            'end_date.after_or_equal' => __('messages.end_before_start'),
        ];
    }

    /**
     * Normalises currency codes so "sar" and "SAR" are stored identically.
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('currency')) {
            $this->merge(['currency' => strtoupper((string) $this->input('currency'))]);
        }
    }
}
