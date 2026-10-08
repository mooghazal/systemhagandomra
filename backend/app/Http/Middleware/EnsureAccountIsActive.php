<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Turns away a suspended account, or one whose company has been suspended.
 *
 * Gate::before already refuses these, but only on routes that ask a policy
 * something. A route that reads data without an authorisation check — a
 * counter, a profile, a catalogue — never invokes Gate at all, so the kill
 * switch quietly did not apply there: a terminated employee kept a working
 * token and a live read channel into their old company.
 *
 * Enforcing it as middleware makes the check a property of being
 * authenticated rather than of remembering to call authorize(), so a route
 * added later is covered by default instead of by diligence.
 */
class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        if (! $user->is_active) {
            return ApiResponse::error('This account has been disabled.', 403);
        }

        if (! $user->companyIsActive()) {
            return ApiResponse::error('This company account has been disabled.', 403);
        }

        return $next($request);
    }
}
