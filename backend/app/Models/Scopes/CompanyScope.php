<?php

namespace App\Models\Scopes;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * Constrains every query on a company-owned model to the authenticated user's
 * own company.
 *
 * This is the backstop for tenant isolation, not the only check: policies also
 * compare company_id on each record. The scope exists so that a forgotten
 * `where` in a controller cannot leak another tenant's rows.
 *
 * Super admins are deliberately unscoped — they operate across companies and
 * are expected to narrow their queries explicitly.
 */
class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $user = Auth::user();

        // No authenticated user means console commands, seeders and tests,
        // where there is no tenant to scope to. Every API route is behind
        // auth:sanctum, so unauthenticated HTTP never reaches a query.
        if (! $user instanceof User) {
            return;
        }

        if ($user->role->belongsToCompany()) {
            $builder->where($model->qualifyColumn('company_id'), $user->company_id);
        }
    }
}
