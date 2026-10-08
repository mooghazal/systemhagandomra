import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { describeError, type HagamraClient } from '../lib/client.js';
import { buildPayload, fail, ok, okList } from '../lib/payload.js';
import type { Package } from '../types.js';

/**
 * Hajj and Umrah packages.
 *
 * Only `name` is required anywhere here. That is not an oversight — a company
 * may record a package it has not priced yet, or one with no fixed dates. The
 * agent must leave unknown fields out and ask, never fill them in.
 */

const OPTIONAL_FIELD_NOTE =
  'Every field except `name` is optional. Omit what you were not told; do NOT invent a value. ' +
  'If a detail seems important and you were not given it, ask the person.';

const features = z
  .array(z.string().max(100))
  .max(50)
  .describe(
    'Services included, as free text — e.g. ["Hotel", "Transportation", "Meals"] or the ' +
      'Arabic equivalents. Any label is accepted; there is no fixed list. Pass [] to record ' +
      '"no features", which is different from omitting the field.',
  );

const createShape = {
  name: z.string().min(1).max(255).describe('The package name. The only required field.'),
  description: z.string().max(10_000).optional().describe('A longer description.'),
  price: z
    .number()
    .min(0)
    .max(99_999_999.99)
    .optional()
    .describe('Price as a number, no currency symbol. 0 means free; omit it if unpriced.'),
  currency: z
    .string()
    .length(3)
    .optional()
    .describe('Three-letter code, e.g. "SAR", "EGP", "USD". Only meaningful alongside a price.'),
  days: z.number().int().min(1).max(365).optional().describe('Trip length in days.'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD.'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('YYYY-MM-DD. Must be on or after start_date.'),
  trip_type: z
    .string()
    .max(100)
    .optional()
    .describe(
      'Free text, e.g. "Hajj", "Umrah", "Ramadan Umrah", "VIP", "Economy", or Arabic. ' +
        'Not a fixed list — use whatever the person said.',
    ),
  location: z.string().max(255).optional().describe('Destination, e.g. "Makkah and Madinah".'),
  features: features.optional(),
  is_active: z.boolean().optional().describe('Whether the package is on offer. Defaults to true.'),
};

/*
 * On update every field also accepts null, which is how the agent says
 * "clear this". Omitting the field leaves it untouched. See buildPayload.
 */
const updateShape = {
  package_id: z.number().int().positive().describe('The id of the package to change.'),
  name: z.string().min(1).max(255).optional().describe('New name. Cannot be cleared.'),
  description: z.string().max(10_000).nullable().optional(),
  price: z.number().min(0).max(99_999_999.99).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  days: z.number().int().min(1).max(365).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  trip_type: z.string().max(100).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  features: features.nullable().optional(),
  is_active: z.boolean().optional(),
};

export function registerPackageTools(server: McpServer, client: HagamraClient): void {
  server.registerTool(
    'hagamra_list_packages',
    {
      title: 'List packages',
      description: `List the Hajj and Umrah packages belonging to the signed-in account's company.

Results are always limited to that one company — another company's packages are not
visible and cannot be reached by guessing an id.

Args:
  - search (string, optional): matches the package name
  - trip_type (string, optional): exact match on the trip type
  - min_price / max_price (number, optional)
  - location (string, optional): partial match
  - is_active (boolean, optional)
  - page (number, optional): 1-based, default 1
  - per_page (number, optional): 1-100, default 25

Returns JSON: { total, page, last_page, count, packages: [...], next_page? }
Each package may have nulls: price, days, dates, trip_type and location are all optional,
and null means "not recorded" — not zero, and not an error.`,
      inputSchema: {
        search: z.string().max(200).optional(),
        trip_type: z.string().max(100).optional(),
        min_price: z.number().min(0).optional(),
        max_price: z.number().min(0).optional(),
        location: z.string().max(255).optional(),
        is_active: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(100).default(25),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const page = await client.list<Package>('packages', {
          search: params.search,
          trip_type: params.trip_type,
          min_price: params.min_price,
          max_price: params.max_price,
          location: params.location,
          is_active: params.is_active === undefined ? undefined : params.is_active ? 1 : 0,
          page: params.page,
          per_page: params.per_page,
        });

        return okList(page, 'packages');
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_get_package',
    {
      title: 'Get a package',
      description: `Fetch one package by id, with all of its details.

Returns 'Not found' both when no such package exists and when it belongs to another
company — the two are deliberately indistinguishable. Use hagamra_list_packages to find
a valid id.`,
      inputSchema: { package_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ package_id }) => {
      try {
        return ok(await client.get<Package>(`packages/${package_id}`));
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_create_package',
    {
      title: 'Create a package',
      description: `Create a package for the signed-in account's company.

${OPTIONAL_FIELD_NOTE}

The company is taken from the account this agent acts as. There is no company
parameter, and one cannot be supplied — a package always belongs to the caller's own
company.

Needs the \`packages.create\` permission. Without it the call is refused and no amount
of rephrasing will change that; say which permission is missing instead of retrying.

Example — the person said "add a Ramadan Umrah package, 10 days, 35000 riyals":
  { "name": "Ramadan Umrah", "days": 10, "price": 35000, "currency": "SAR" }
Note what is absent: no dates, no location, no features, because they were not mentioned.`,
      inputSchema: createShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const created = await client.post<Package>('packages', buildPayload(params));

        return ok(created, `Created package #${created.id} "${created.name}".`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_update_package',
    {
      title: 'Update a package',
      description: `Change an existing package. Only the fields you send are touched.

Three distinct things you can express:
  - omit a field        -> left exactly as it is
  - send null           -> cleared ("we no longer record a price")
  - send a value        -> set, including 0, false and []

So { "package_id": 7, "price": null } removes the price, while
   { "package_id": 7, "price": 0 } marks it free. Do not confuse the two.

\`name\` cannot be cleared, only changed.

Needs the \`packages.update\` permission.`,
      inputSchema: updateShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ package_id, ...changes }) => {
      try {
        const payload = buildPayload(changes);

        if (Object.keys(payload).length === 0) {
          return fail(
            'No changes were given. Supply at least one field to change, or ask the person what ' +
              'they want changed.',
          );
        }

        const updated = await client.put<Package>(`packages/${package_id}`, payload);

        return ok(updated, `Updated package #${updated.id}: ${Object.keys(payload).join(', ')}.`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_delete_package',
    {
      title: 'Delete a package',
      description: `Delete a package.

This is a soft delete: the record stops appearing anywhere in the system but is not
destroyed, and can be restored from the database by an administrator.

Confirm with the person before calling this — name the package you are about to delete
so they can catch a wrong id.

Needs the \`packages.delete\` permission.`,
      inputSchema: { package_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ package_id }) => {
      try {
        await client.delete(`packages/${package_id}`);

        return ok({ deleted: true, package_id }, `Deleted package #${package_id}.`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );
}
