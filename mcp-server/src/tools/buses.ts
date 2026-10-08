import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { describeError, type HagamraClient } from '../lib/client.js';
import { buildPayload, fail, ok, okList } from '../lib/payload.js';
import type { Bus } from '../types.js';

/** The transport fleet. Only `name` is required. */

const features = z
  .array(z.string().max(100))
  .max(50)
  .describe(
    'Amenities as free text — e.g. ["Air conditioning", "Wifi", "USB charging"] or Arabic ' +
      'equivalents. Pass [] to record "no amenities".',
  );

const createShape = {
  name: z.string().min(1).max(255).describe('The bus name or fleet number. The only required field.'),
  type: z
    .string()
    .max(255)
    .optional()
    .describe('Free text, e.g. "VIP", "Standard", "Sleeper", or Arabic.'),
  capacity: z.number().int().min(1).max(200).optional().describe('Number of seats.'),
  model: z.string().max(255).optional().describe('e.g. "Mercedes Tourismo".'),
  description: z.string().max(10_000).optional(),
  features: features.optional(),
  is_active: z.boolean().optional(),
};

const updateShape = {
  bus_id: z.number().int().positive().describe('The id of the bus to change.'),
  name: z.string().min(1).max(255).optional().describe('New name. Cannot be cleared.'),
  type: z.string().max(255).nullable().optional(),
  capacity: z.number().int().min(1).max(200).nullable().optional(),
  model: z.string().max(255).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  features: features.nullable().optional(),
  is_active: z.boolean().optional(),
};

export function registerBusTools(server: McpServer, client: HagamraClient): void {
  server.registerTool(
    'hagamra_list_buses',
    {
      title: 'List buses',
      description: `List the buses belonging to the signed-in account's company.

Args:
  - search (string, optional): matches the bus name
  - type (string, optional): exact match
  - min_capacity (number, optional)
  - is_active (boolean, optional)
  - page / per_page (number, optional)

Returns JSON: { total, page, last_page, count, buses: [...], next_page? }`,
      inputSchema: {
        search: z.string().max(200).optional(),
        type: z.string().max(255).optional(),
        min_capacity: z.number().int().min(1).optional(),
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
        const page = await client.list<Bus>('buses', {
          search: params.search,
          type: params.type,
          min_capacity: params.min_capacity,
          is_active: params.is_active === undefined ? undefined : params.is_active ? 1 : 0,
          page: params.page,
          per_page: params.per_page,
        });

        return okList(page, 'buses');
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_get_bus',
    {
      title: 'Get a bus',
      description: `Fetch one bus by id.

Returns 'Not found' both when no such bus exists and when it belongs to another
company. Use hagamra_list_buses to find a valid id.`,
      inputSchema: { bus_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ bus_id }) => {
      try {
        return ok(await client.get<Bus>(`buses/${bus_id}`));
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_create_bus',
    {
      title: 'Create a bus',
      description: `Create a bus for the signed-in account's company.

Every field except \`name\` is optional. Omit what you were not told; do NOT invent a
value — a guessed seat count is worse than none.

Needs the \`buses.create\` permission.

Example — "add a VIP bus, 30 seats, Mercedes Tourismo":
  { "name": "VIP Coach 1", "type": "VIP", "capacity": 30, "model": "Mercedes Tourismo" }`,
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
        const created = await client.post<Bus>('buses', buildPayload(params));

        return ok(created, `Created bus #${created.id} "${created.name}".`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_update_bus',
    {
      title: 'Update a bus',
      description: `Change an existing bus. Only the fields you send are touched.

  - omit a field  -> left as it is
  - send null     -> cleared
  - send a value  -> set

\`name\` cannot be cleared, only changed.

Needs the \`buses.update\` permission.`,
      inputSchema: updateShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ bus_id, ...changes }) => {
      try {
        const payload = buildPayload(changes);

        if (Object.keys(payload).length === 0) {
          return fail('No changes were given. Supply at least one field to change.');
        }

        const updated = await client.put<Bus>(`buses/${bus_id}`, payload);

        return ok(updated, `Updated bus #${updated.id}: ${Object.keys(payload).join(', ')}.`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_delete_bus',
    {
      title: 'Delete a bus',
      description: `Delete a bus.

A soft delete: recoverable by an administrator. Confirm with the person first, naming
the bus.

Needs the \`buses.delete\` permission.`,
      inputSchema: { bus_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ bus_id }) => {
      try {
        await client.delete(`buses/${bus_id}`);

        return ok({ deleted: true, bus_id }, `Deleted bus #${bus_id}.`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );
}
