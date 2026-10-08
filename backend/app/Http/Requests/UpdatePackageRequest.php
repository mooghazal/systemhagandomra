<?php

namespace App\Http\Requests;

use App\Enums\TripType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Validator;

/**
 * Partial update.
 *
 * Every rule starts with `sometimes`, so a field that is not sent is left
 * exactly as it was, while a field sent as null is actively cleared. That
 * distinction is what lets a caller — including the AI agent — change one
 * attribute without having to restate, or guess at, the rest of the record.
 *
 * `company_id` is absent from the rules entirely: a package never moves between
 * companies.
 */
class UpdatePackageRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],

            'price' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'currency' => ['sometimes', 'nullable', 'string', 'size:3', 'alpha'],

            'days' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:365'],

            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],

            'trip_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],

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
            'end_date.after_or_equal' => __('messages.end_before_start'),
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('currency')) {
            $this->merge(['currency' => strtoupper((string) $this->input('currency'))]);
        }
    }

    /**
     * Compares the dates the record will *end up with*, not just the ones in
     * the payload: changing only the start date must still be checked against
     * the stored end date, and vice versa.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->hasAny(['start_date', 'end_date'])) {
                return;
            }

            $package = $this->route('package');

            $start = $this->has('start_date') ? $this->date('start_date') : $package?->start_date;
            $end = $this->has('end_date') ? $this->date('end_date') : $package?->end_date;

            if ($start !== null && $end !== null && $end->lessThan($start)) {
                $validator->errors()->add(
                    'end_date',
                    'The end date must fall on or after the start date.'
                );
            }
        });
    }
}
