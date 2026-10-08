import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { describeError, type HagamraClient } from '../lib/client.js';
import { fail, ok } from '../lib/payload.js';
import type { Session } from '../types.js';

/**
 * Who the agent is acting as.
 *
 * Worth having as a tool rather than assumed, because every other tool's
 * outcome depends on it: the company whose data is visible, and the
 * permissions that decide which writes will be accepted. An agent that checks
 * this first can tell someone "you don't have permission to do that" before
 * attempting it, instead of after.
 */
export function registerIdentityTools(server: McpServer, client: HagamraClient): void {
  server.registerTool(
    'hagamra_whoami',
    {
      title: 'Who am I acting as',
      description: `Report the account this agent is acting as, and what it may do.

Call this when you are unsure whether an action is permitted, or at the start of a
conversation to know whose company you are working in.

Returns JSON:
  {
    "user": { "id", "name", "email", "role", "role_label", "is_active",
              "company_id", "company": { "id", "name", ... } },
    "permissions": ["packages.view", ...]
  }

The role determines the shape of everything else:
  - "owner"      — holds every permission inside their own company
  - "employee"   — holds exactly the permissions listed
  - "super_admin" — sees across companies, but CANNOT create anything through this
                    server, because creating requires naming a company and these tools
                    do not offer that. Reads work; writes will fail.

Every list and every write is confined to this account's company. There is no tool,
parameter or phrasing that reaches another company's data — the backend decides that
from the token, not from anything you send.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const session = await client.get<Session>('auth/me');

        const summary =
          session.user.role === 'super_admin'
            ? `Acting as ${session.user.name}, a super admin. Reads span every company; ` +
              'creating anything will fail, because these tools cannot name a company.'
            : `Acting as ${session.user.name} (${session.user.role_label}) at ` +
              `${session.user.company?.name ?? 'an unknown company'}, with ` +
              `${session.permissions.length} permission(s).`;

        return ok(session, summary);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );
}
