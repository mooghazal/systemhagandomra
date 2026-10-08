import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { describeError, type HagamraClient } from '../lib/client.js';
import { buildPayload, fail, ok, okList } from '../lib/payload.js';
import type { Hotel } from '../types.js';

/**
 * Hotels.
 *
 * The two distance fields deserve a note: a hotel in Makkah has no meaningful
 * distance to Masjid an-Nabawi and one in Madinah has none to the Haram. Both
 * are optional, and leaving one out is the normal case rather than missing
 * data.
 */

const features = z
  .array(z.string().max(100))
  .max(50)
  .describe(
    'Amenities as free text — e.g. ["Breakfast", "Wifi", "Elevator"] or Arabic equivalents. ' +
      'Any label is accepted. Pass [] to record "no amenities".',
  );

const createShape = {
  name: z.string().min(1).max(255).describe('The hotel name. The only required field.'),
  location: z.string().max(255).optional().describe('City or area, e.g. "Makkah", "Madinah".'),
  description: z.string().max(10_000).optional(),
  distance_from_haram: z
    .number()
    .int()
    .min(0)
    .max(100_000)
    .optional()
    .describe('Walking distance to the Haram in METRES. Omit for a hotel in Madinah.'),
  distance_from_masjid_nabawi: z
    .number()
    .int()
    .min(0)
    .max(100_000)
    .optional()
    .describe('Walking distance to Masjid an-Nabawi in METRES. Omit for a hotel in Makkah.'),
  rating: z.number().int().min(1).max(5).optional().describe('Stars, 1 to 5.'),
  room_type: z
    .string()
    .max(255)
    .optional()
    .describe('Free text, e.g. "Quad", "Triple", "Suite", or Arabic.'),
  features: features.optional(),
  is_active: z.boolean().optional(),
};

const updateShape = {
  hotel_id: z.number().int().positive().describe('The id of the hotel to change.'),
  name: z.string().min(1).max(255).optional().describe('New name. Cannot be cleared.'),
  location: z.string().max(255).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  distance_from_haram: z.number().int().min(0).max(100_000).nullable().optional(),
  distance_from_masjid_nabawi: z.number().int().min(0).max(100_000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  room_type: z.string().max(255).nullable().optional(),
  features: features.nullable().optional(),
  is_active: z.boolean().optional(),
};

export function registerHotelTools(server: McpServer, client: HagamraClient): void {
  server.registerTool(
    'hagamra_list_hotels',
    {
      title: 'List hotels',
      description: `List the hotels belonging to the signed-in account's company.

Args:
  - search (string, optional): matches the hotel name
  - location (string, optional): partial match
  - min_rating (number, optional): 1-5, returns that rating and above
  - max_distance_from_haram (number, optional): in METRES
  - max_distance_from_masjid_nabawi (number, optional): in METRES
  - is_active (boolean, optional)
  - page / per_page (number, optional)

Returns JSON: { total, page, last_page, count, hotels: [...], next_page? }
Distances are in metres and either may be null — that is expected, not missing data.`,
      inputSchema: {
        search: z.string().max(200).optional(),
        location: z.string().max(255).optional(),
        min_rating: z.number().int().min(1).max(5).optional(),
        max_distance_from_haram: z.number().int().min(0).optional(),
        max_distance_from_masjid_nabawi: z.number().int().min(0).optional(),
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
        const page = await client.list<Hotel>('hotels', {
          search: params.search,
          location: params.location,
          min_rating: params.min_rating,
          max_distance_from_haram: params.max_distance_from_haram,
          max_distance_from_masjid_nabawi: params.max_distance_from_masjid_nabawi,
          is_active: params.is_active === undefined ? undefined : params.is_active ? 1 : 0,
          page: params.page,
          per_page: params.per_page,
        });

        return okList(page, 'hotels');
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_get_hotel',
    {
      title: 'Get a hotel',
      description: `Fetch one hotel by id.

Returns 'Not found' both when no such hotel exists and when it belongs to another
company. Use hagamra_list_hotels to find a valid id.`,
      inputSchema: { hotel_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hotel_id }) => {
      try {
        return ok(await client.get<Hotel>(`hotels/${hotel_id}`));
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_create_hotel',
    {
      title: 'Create a hotel',
      description: `Create a hotel for the signed-in account's company.

Every field except \`name\` is optional. Omit what you were not told; do NOT invent a
value — especially the distances, which are in metres and are frequently misremembered
as kilometres. If the person says "about 1 km from the Haram", that is 1000.

Record only the distance that applies: a Makkah hotel has no distance to Masjid
an-Nabawi, and vice versa.

Needs the \`hotels.create\` permission.

Example — "add Swissotel Al Maqam in Makkah, 5 stars, 150 metres from the Haram":
  { "name": "Swissotel Al Maqam", "location": "Makkah", "rating": 5,
    "distance_from_haram": 150 }`,
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
        const created = await client.post<Hotel>('hotels', buildPayload(params));

        return ok(created, `Created hotel #${created.id} "${created.name}".`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_update_hotel',
    {
      title: 'Update a hotel',
      description: `Change an existing hotel. Only the fields you send are touched.

  - omit a field  -> left as it is
  - send null     -> cleared
  - send a value  -> set

\`name\` cannot be cleared, only changed.

Needs the \`hotels.update\` permission.`,
      inputSchema: updateShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hotel_id, ...changes }) => {
      try {
        const payload = buildPayload(changes);

        if (Object.keys(payload).length === 0) {
          return fail('No changes were given. Supply at least one field to change.');
        }

        const updated = await client.put<Hotel>(`hotels/${hotel_id}`, payload);

        return ok(updated, `Updated hotel #${updated.id}: ${Object.keys(payload).join(', ')}.`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );

  server.registerTool(
    'hagamra_delete_hotel',
    {
      title: 'Delete a hotel',
      description: `Delete a hotel.

A soft delete: the record disappears from the system but is recoverable by an
administrator. Confirm with the person first, naming the hotel.

Needs the \`hotels.delete\` permission.`,
      inputSchema: { hotel_id: z.number().int().positive() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hotel_id }) => {
      try {
        await client.delete(`hotels/${hotel_id}`);

        return ok({ deleted: true, hotel_id }, `Deleted hotel #${hotel_id}.`);
      } catch (error) {
        return fail(describeError(error));
      }
    },
  );
}
