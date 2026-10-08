<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Super-admin only. An owner cannot be moved to another company or demoted
 * here; there is no field for either.
 */
class UpdateOwnerRequest extends FormRequest
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
        // manageOwners on the company in the route, matching OwnerController::update.
        return $this->user()?->can('manageOwners', $this->route('company')) ?? false;
    }

    public function rules(): array
    {
        $ownerId = $this->route('owner')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes', 'required', 'email:rfc', 'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at')->ignore($ownerId),
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
