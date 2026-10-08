<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Partial update of an employee account.
 *
 * `role`, `company_id` and `permissions` are absent on purpose: the first two
 * are immutable for an existing account, and permissions are changed through
 * their own endpoint so they can carry a stricter authorisation check.
 */
class UpdateEmployeeRequest extends FormRequest
{
    public function rules(): array
    {
        $employeeId = $this->route('employee')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes', 'required', 'email:rfc', 'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at')->ignore($employeeId),
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
