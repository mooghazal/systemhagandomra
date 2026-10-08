<?php

namespace App\Support;

use App\Enums\AuditSource;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Decides which client path the current request arrived through, for the audit
 * trail.
 *
 * The answer comes from the access token's abilities, which are fixed when the
 * token is issued and cannot be changed by the caller. A client may *narrow*
 * the label between the two interactive paths (dashboard vs. direct API) with a
 * header, because neither carries more privilege than the other — but no header
 * can claim, or disclaim, the MCP agent path.
 */
class RequestSource
{
    public const HEADER = 'X-Client-Source';

    public const MCP_ABILITY = 'mcp';

    public function __construct(private readonly AuthFactory $auth) {}

    public function resolve(?string $header = null): AuditSource
    {
        if ($this->isMcpToken()) {
            return AuditSource::McpAgent;
        }

        return match (strtolower(trim((string) $header))) {
            'dashboard' => AuditSource::Dashboard,
            default => AuditSource::Api,
        };
    }

    public function isMcpToken(): bool
    {
        $token = $this->currentToken();

        /*
         * An exact match, deliberately not $token->can('mcp').
         *
         * Sanctum's can() treats the '*' ability as "yes to everything", which
         * every ordinary dashboard token carries — so can() would label the
         * whole system as agent traffic. The agent path is identified by an
         * ability granted explicitly and only to MCP clients.
         */
        return $token !== null
            && in_array(self::MCP_ABILITY, (array) $token->abilities, true);
    }

    private function currentToken(): ?PersonalAccessToken
    {
        $user = $this->auth->guard('sanctum')->user();

        if ($user === null || ! method_exists($user, 'currentAccessToken')) {
            return null;
        }

        $token = $user->currentAccessToken();

        return $token instanceof PersonalAccessToken ? $token : null;
    }
}
