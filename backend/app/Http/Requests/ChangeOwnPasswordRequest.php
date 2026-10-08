<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * Changing your own password.
 *
 * The current password is required even though the caller is already
 * authenticated, and that is the whole point of this class. A valid token is
 * not proof that the person holding it is the account's owner — a borrowed
 * laptop, a session left open, a stolen cookie all present one. Asking for the
 * password again is the only thing here that distinguishes the account holder
 * from whoever currently has their session.
 */
class ChangeOwnPasswordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'current_password:sanctum'],
            // `confirmed` pairs this with password_confirmation. Locking
            // yourself out of your own account over a typo is a bad day, and
            // the field is masked so nobody can check it by looking.
            'password' => ['required', 'string', 'confirmed', 'different:current_password', Password::defaults()],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.current_password' => __('messages.current_password_incorrect'),
            'password.different' => __('messages.password_must_differ'),
        ];
    }
}
