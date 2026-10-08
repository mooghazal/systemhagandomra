<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Permissions;

/**
 * Authorisation for employee accounts.
 *
 * Beyond the usual permission-plus-tenant pair, two rules exist specifically to
 * block privilege escalation from inside a company:
 *
 *   - only an owner (or a super admin) may change a permission set. An
 *     employee holding `employees.update` can edit colleagues but cannot grant
 *     permissions — otherwise that one permission would be enough to award
 *     itself every other one.
 *   - the employee endpoints refuse to act on owners and super admins at all,
 *     so `employees.update` can never be turned against a more privileged
 *     account.
 *
 * Super admins never reach these methods — Gate::before resolves them first.
 */
class EmployeePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permissions::EMPLOYEES_VIEW);
    }

    public function view(User $user, User $employee): bool
    {
        return $user->hasPermissionTo(Permissions::EMPLOYEES_VIEW)
            && $this->isManageableEmployee($user, $employee);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(Permissions::EMPLOYEES_CREATE);
    }

    public function update(User $user, User $employee): bool
    {
        return $user->hasPermissionTo(Permissions::EMPLOYEES_UPDATE)
            && $this->isManageableEmployee($user, $employee);
    }

    public function delete(User $user, User $employee): bool
    {
        // Deleting your own account through the employee endpoints would lock
        // the company out of its own staff list by accident.
        if ($user->is($employee)) {
            return false;
        }

        return $user->hasPermissionTo(Permissions::EMPLOYEES_DELETE)
            && $this->isManageableEmployee($user, $employee);
    }

    /**
     * Granting and revoking permissions is an owner-level act.
     */
    public function managePermissions(User $user, User $employee): bool
    {
        return $this->grantPermissions($user)
            && $this->isManageableEmployee($user, $employee);
    }

    /**
     * Changing the keys to an account — its password, the address it can be
     * recovered through, or whether it works at all — is likewise owner-level.
     *
     * Without this, `employees.update` is a complete privilege escalation:
     * an employee holding only that one permission could set a colleague's
     * password, sign in as them, and inherit every permission the colleague
     * has. The permission system would be intact and entirely bypassed.
     *
     * The same reasoning covers the other two fields. Re-pointing a
     * colleague's e-mail hands over any future account recovery, and
     * disabling them locks a colleague out — neither is a correction to
     * someone's details, which is what `employees.update` is for.
     */
    public function manageCredentials(User $user, User $employee): bool
    {
        return $this->grantPermissions($user)
            && $this->isManageableEmployee($user, $employee);
    }

    /**
     * The same rule for an account that does not exist yet, used when a create
     * request arrives with a permission list attached.
     */
    public function grantPermissions(User $user): bool
    {
        return $user->isOwner() && $user->is_active;
    }

    private function isManageableEmployee(User $user, User $employee): bool
    {
        return $employee->isEmployee()
            && $user->belongsToCompanyId($employee->company_id);
    }
}
