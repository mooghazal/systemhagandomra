<?php

namespace App\Http\Requests;

use App\Services\ImageStorage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Super-admin only (CompanyPolicy::create).
 *
 * An optional `owner` block creates the company's first owner account in the
 * same transaction, which is the only path that ever assigns the owner role.
 * `slug` is not accepted — CompanyService derives it from the name.
 */
class StoreCompanyRequest extends FormRequest
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
        // matching CompanyController::store.
        return $this->user()?->can('create', \App\Models\Company::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'domain' => [
                'nullable', 'string', 'max:255',
                Rule::unique('companies', 'domain')->whereNull('deleted_at'),
            ],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:500'],
            'logo' => ImageStorage::validationRules(),
            'is_active' => ['nullable', 'boolean'],

            'owner' => ['nullable', 'array'],
            'owner.name' => ['required_with:owner', 'string', 'max:255'],
            'owner.email' => ['required_with:owner', 'email:rfc', 'max:255', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'owner.password' => ['required_with:owner', 'string', Password::defaults()],
            'owner.phone' => ['nullable', 'string', 'max:32'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('owner.email')) {
            $this->merge([
                'owner' => array_merge((array) $this->input('owner'), [
                    'email' => mb_strtolower(trim((string) $this->input('owner.email'))),
                ]),
            ]);
        }
    }
}
