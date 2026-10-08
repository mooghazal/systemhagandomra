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
     * Granting and revoking permissions.
     *
     * An owner always may. Anyone else needs `employees.permissions`, and is
     * then bound by two rules that are what make the permission safe to hand
     * out at all:
     *
     *   - never on their own account. Otherwise the permission is worth all
     *     the others: grant yourself the rest and the set means nothing.
     *   - never on a colleague who holds something they do not. Saving
     *     replaces the whole set, so without this a delegate would silently
     *     strip a colleague of a permission they were never able to grant
     *     back — and "can he take this from me" would have a different answer
     *     than "can he give it to me", which is not a rule anyone can keep in
     *     their head.
     *
     * The second rule costs nothing in the ordinary case: a manager holding
     * everything can manage everyone.
     */
    public function managePermissions(User $user, User $employee): bool
    {
        if (! $this->grantPermissions($user) || ! $this->isManageableEmployee($user, $employee)) {
            return false;
        }

        if ($this->isActiveOwner($user)) {
            return true;
        }

        return ! $user->is($employee)
            && $this->holdsAllOf($user, $employee->permissionNames()->all());
    }

    /**
     * Whether `$user` may hand out exactly this set.
     *
     * Checked separately from managePermissions because the two ask different
     * questions: that one is about the account being edited, this one about
     * what is being written to it. A delegate passing the first still cannot
     * grant beyond their own set.
     *
     * @param  array<int, string>  $permissions
     */
    public function grantExactly(User $user, array $permissions): bool
    {
        return $this->isActiveOwner($user) || $this->holdsAllOf($user, $permissions);
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
        /*
         * Spelled out rather than delegating to grantPermissions().
         *
         * The two were the same check until granting became delegable. Had
         * this kept calling it, adding `employees.permissions` would have
         * handed every manager the ability to set a colleague's password —
         * sign in as them, inherit everything they hold — which is the exact
         * escalation the docblock above describes. Two rules that happen to
         * agree are not one rule.
         */
        return $this->isActiveOwner($user) && $this->isManageableEmployee($user, $employee);
    }

    /**
     * Whether this account may grant permissions at all.
     *
     * Used on its own when a create request arrives with a permission list
     * attached, for an account that does not exist yet.
     */
    public function grantPermissions(User $user): bool
    {
        return $this->isActiveOwner($user)
            || $user->hasPermissionTo(Permissions::EMPLOYEES_PERMISSIONS);
    }

    private function isActiveOwner(User $user): bool
    {
        return $user->isOwner() && $user->is_active;
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function holdsAllOf(User $user, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (! $user->hasPermissionTo($permission)) {
                return false;
            }
        }

        return true;
    }

    private function isManageableEmployee(User $user, User $employee): bool
    {
        return $employee->isEmployee()
            && $user->belongsToCompanyId($employee->company_id);
    }
}
