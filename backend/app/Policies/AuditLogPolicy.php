<?php

namespace App\Policies;

use App\Models\AuditLog;
use App\Models\User;

/**
 * The audit trail is readable by super admins (everything) and company owners
 * (their own company only). Employees have no access: the trail records
 * actions taken against them, so it is not theirs to read.
 *
 * Nothing may write, edit or delete through a policy — the trail is append-only
 * and only App\Services\AuditLogger adds to it.
 */
class AuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isOwner() && $user->is_active;
    }

    public function view(User $user, AuditLog $log): bool
    {
        return $this->viewAny($user)
            && $user->belongsToCompanyId($log->company_id);
    }
}
