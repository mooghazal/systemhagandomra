<?php

namespace App\Policies;

use App\Models\Company;
use App\Models\User;

/**
 * Company records are system-level: only a super admin may list, create,
 * change or remove them, which Gate::before grants before any method here runs.
 *
 * The one thing a company user may do is read their own company, which the
 * dashboard needs for its header and settings screen.
 */
class CompanyPolicy
{
    public function viewAny(User $user): bool
    {
        return false;
    }

    public function view(User $user, Company $company): bool
    {
        return $user->company_id === $company->id;
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, Company $company): bool
    {
        return false;
    }

    public function delete(User $user, Company $company): bool
    {
        return false;
    }

    /** Creating, editing and removing owner accounts. */
    public function manageOwners(User $user, Company $company): bool
    {
        return false;
    }
}
