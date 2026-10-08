<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ResolvesCompanyInput;
use App\Support\Permissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Note what is *not* here: `role`, `is_admin`, and (for company users)
 * `company_id`. An account created through this endpoint is always an employee
 * of the caller's company — EmployeeService sets both itself, so there is no
 * field for a caller to push a different value into.
 *
 * Permissions may be supplied at creation, but only an owner or super admin
 * can get past EmployeePolicy::managePermissions to use them.
 */
class StoreEmployeeRequest extends FormRequest
{
    use ResolvesCompanyInput;

    /**
     * Runs before rules(), which matters here.
     *
     * The e-mail uniqueness rule is global — it has to be, since addresses are
     * unique across the system — so validating first would answer "that
     * e-mail is taken" to someone with no right to ask. The 422-versus-403
     * split then tells them which addresses have accounts, including another
     * company's owner and the super admin.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', \App\Models\User::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'company_id' => $this->companyIdRules(),

            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'password' => ['required', 'string', Password::defaults()],
            'phone' => ['nullable', 'string', 'max:32'],
            'is_active' => ['nullable', 'boolean'],

            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(Permissions::all())],
        ];
    }

    public function messages(): array
    {
        return [
            'permissions.*.in' => __('messages.permission_unknown'),
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
        }
    }
}
