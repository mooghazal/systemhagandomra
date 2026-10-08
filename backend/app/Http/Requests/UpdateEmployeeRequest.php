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
    /**
     * Runs before rules(), which matters here.
     *
     * The e-mail uniqueness rule is global — it has to be, since addresses are
     * unique across the system — so validating first answers "that e-mail is
     * taken" to someone with no right to ask. The 422-versus-403 split is then
     * an oracle over every account in the system, including other companies'
     * owners and the super admin, usable by an employee holding no permissions
     * at all. StoreEmployeeRequest has guarded against exactly this since it
     * was written; these four did not.
     */
    public function authorize(): bool
    {
        // matching EmployeeController::update.
        return $this->user()?->can('update', $this->route('employee')) ?? false;
    }

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
