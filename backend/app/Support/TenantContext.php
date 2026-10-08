<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Validation\ValidationException;

/**
 * Resolves which company the current request is allowed to act on.
 *
 * This is the one place that answers "whose data is this?", and it answers it
 * from the authenticated identity alone. A `company_id` arriving in a request
 * body is accepted only from a super admin, who has no company of their own and
 * therefore must name one; for owners and employees it is ignored outright
 * rather than rejected, so a tampered payload silently resolves to the caller's
 * real company instead of leaking the existence of another.
 *
 * Every client path — dashboard, direct API, MCP agent — goes through here.
 */
class TenantContext
{
    public function __construct(private readonly AuthFactory $auth) {}

    /**
     * @throws AuthenticationException
     */
    public function user(): User
    {
        $user = $this->auth->guard('sanctum')->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }

    public function actor(): ?User
    {
        $user = $this->auth->guard('sanctum')->user();

        return $user instanceof User ? $user : null;
    }

    public function isSuperAdmin(): bool
    {
        return $this->user()->isSuperAdmin();
    }

    /**
     * The caller's own company, or null for a super admin.
     */
    public function companyId(): ?int
    {
        return $this->user()->company_id;
    }

    /**
     * The company a write should be attributed to.
     *
     * For owners and employees the requested value is discarded. For a super
     * admin it is required, because they have no company of their own.
     *
     * @throws ValidationException when a super admin omits the company
     */
    public function resolveCompanyIdForWrite(?int $requested): int
    {
        $user = $this->user();

        if ($user->role->belongsToCompany()) {
            return $user->company_id;
        }

        if ($requested === null) {
            throw ValidationException::withMessages([
                'company_id' => __('messages.company_required'),
            ]);
        }

        return $requested;
    }

    /**
     * The company a read should be limited to, or null to mean "every company"
     * (super admin without a filter).
     */
    public function resolveCompanyIdForRead(?int $requested): ?int
    {
        $user = $this->user();

        if ($user->role->belongsToCompany()) {
            return $user->company_id;
        }

        return $requested;
    }
}
