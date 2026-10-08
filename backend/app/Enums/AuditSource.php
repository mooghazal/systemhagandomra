<?php

namespace App\Enums;

/**
 * Which client path an audited operation arrived through.
 *
 * This is resolved from the authenticated access token, never from a header a
 * caller can set freely — see App\Support\RequestSource.
 */
enum AuditSource: string
{
    case Dashboard = 'dashboard';
    case Api = 'api';
    case McpAgent = 'mcp_agent';
}
