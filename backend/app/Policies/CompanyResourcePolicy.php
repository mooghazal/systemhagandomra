<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Authorisation for the three company-owned resources.
 *
 * Each check is the same pair of questions: does the caller hold the
 * permission, and does the record belong to the caller's company. The second
 * question is what stops a correctly-guessed id from another tenant, and it is
 * asked here as well as in CompanyScope so neither alone is load-bearing.
 *
 * Super admins never reach these methods — AuthServiceProvider's Gate::before
 * resolves them first.
 */
abstract class CompanyResourcePolicy
{
    /** e.g. "packages", giving packages.view / .create / .update / .delete */
    abstract protected function permissionPrefix(): string;

    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo($this->permission('view'));
    }

    public function view(User $user, Model $resource): bool
    {
        return $user->hasPermissionTo($this->permission('view'))
            && $this->sameCompany($user, $resource);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo($this->permission('create'));
    }

    public function update(User $user, Model $resource): bool
    {
        return $user->hasPermissionTo($this->permission('update'))
            && $this->sameCompany($user, $resource);
    }

    public function delete(User $user, Model $resource): bool
    {
        return $user->hasPermissionTo($this->permission('delete'))
            && $this->sameCompany($user, $resource);
    }

    public function restore(User $user, Model $resource): bool
    {
        return $this->update($user, $resource);
    }

    protected function sameCompany(User $user, Model $resource): bool
    {
        return $user->belongsToCompanyId($resource->getAttribute('company_id'));
    }

    protected function permission(string $action): string
    {
        return $this->permissionPrefix().'.'.$action;
    }
}
