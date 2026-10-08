<?php

namespace App\Http\Requests\Concerns;

use App\Models\User;
use Illuminate\Validation\Rule;

/**
 * The `company_id` rule shared by every create request.
 *
 * A super admin has no company of their own, so they must name one and it must
 * exist. For an owner or employee the field is *excluded* rather than rejected:
 * dropping it from the validated data means a tampered payload resolves to the
 * caller's own company silently, instead of returning an error that would
 * confirm whether some other company id exists.
 */
trait ResolvesCompanyInput
{
    /**
     * @return array<int, mixed>
     */
    protected function companyIdRules(): array
    {
        return [
            Rule::excludeIf(fn () => ! $this->actingUser()?->isSuperAdmin()),
            'required',
            'integer',
            // Deleted companies are gone as far as writes are concerned;
            // creating inside one produces a record nobody can reach.
            Rule::exists('companies', 'id')->whereNull('deleted_at'),
        ];
    }

    protected function actingUser(): ?User
    {
        $user = $this->user();

        return $user instanceof User ? $user : null;
    }
}
