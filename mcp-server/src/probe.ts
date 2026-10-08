#!/usr/bin/env node
/**
 * A scripted MCP client, for checking the server end to end.
 *
 * It speaks the real protocol over stdio against the real server, which talks
 * to the real Laravel API — so a pass here means the whole chain works, not
 * that a mock agreed with itself.
 *
 *   npm run build && node dist/probe.js
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const PASS = '\u001b[32mPASS\u001b[0m';
const FAIL = '\u001b[31mFAIL\u001b[0m';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) failures++;

  console.log(`  ${condition ? PASS : FAIL}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];

  return content.map((part) => part.text ?? '').join('\n');
}

function isError(result: unknown): boolean {
  return (result as { isError?: boolean }).isError === true;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('./index.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    env: {
      ...(process.env as Record<string, string>),
      HAGAMRA_API_TOKEN: process.env.HAGAMRA_API_TOKEN ?? '',
      HAGAMRA_API_URL: process.env.HAGAMRA_API_URL ?? 'http://127.0.0.1:8000/api',
    },
  });

  const client = new Client({ name: 'hagamra-probe', version: '1.0.0' });

  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`\nConnected. ${tools.length} tools registered.\n`);

  // -- Identity -------------------------------------------------------------
  console.log('Identity');
  const me = await client.callTool({ name: 'hagamra_whoami', arguments: {} });
  const identity = textOf(me);
  check('whoami succeeds', !isError(me));
  check('reports a company', identity.includes('company'), identity.split('\n')[0]);

  // -- Create with only the required field -----------------------------------
  console.log('\nCreating with only a name (the "do not invent" case)');
  const created = await client.callTool({
    name: 'hagamra_create_package',
    arguments: { name: 'MCP probe package' },
  });
  check('create succeeds with name alone', !isError(created), textOf(created).split('\n')[0]);

  const pkg = (created as { structuredContent?: { id?: number; price?: unknown; features?: unknown[] } })
    .structuredContent;

  check('price left null, not zero', pkg?.price === null, `price=${JSON.stringify(pkg?.price)}`);
  check('features empty', Array.isArray(pkg?.features) && pkg.features.length === 0);

  const id = pkg?.id;

  if (typeof id !== 'number') {
    console.log('\nNo package id returned; stopping.');
    await client.close();
    process.exit(1);
  }

  // -- The three-way distinction --------------------------------------------
  console.log('\nOmit vs null vs value');
  await client.callTool({
    name: 'hagamra_update_package',
    arguments: { package_id: id, price: 35000, currency: 'SAR', days: 10 },
  });

  const afterSet = await client.callTool({
    name: 'hagamra_get_package',
    arguments: { package_id: id },
  });
  const set = (afterSet as { structuredContent?: Record<string, unknown> }).structuredContent;
  check('value set', set?.price === 35000, `price=${JSON.stringify(set?.price)}`);

  // Touch only the name; the price must survive.
  await client.callTool({
    name: 'hagamra_update_package',
    arguments: { package_id: id, name: 'MCP probe package (renamed)' },
  });

  const afterOmit = (
    (await client.callTool({ name: 'hagamra_get_package', arguments: { package_id: id } })) as {
      structuredContent?: Record<string, unknown>;
    }
  ).structuredContent;

  check('omitted field untouched', afterOmit?.price === 35000, `price=${JSON.stringify(afterOmit?.price)}`);
  check('sent field changed', afterOmit?.name === 'MCP probe package (renamed)');

  // Explicit null clears.
  await client.callTool({
    name: 'hagamra_update_package',
    arguments: { package_id: id, price: null },
  });

  const afterNull = (
    (await client.callTool({ name: 'hagamra_get_package', arguments: { package_id: id } })) as {
      structuredContent?: Record<string, unknown>;
    }
  ).structuredContent;

  check('null clears the field', afterNull?.price === null, `price=${JSON.stringify(afterNull?.price)}`);
  check('days still intact', afterNull?.days === 10);

  // Zero is a value, not an absence.
  await client.callTool({
    name: 'hagamra_update_package',
    arguments: { package_id: id, price: 0 },
  });

  const afterZero = (
    (await client.callTool({ name: 'hagamra_get_package', arguments: { package_id: id } })) as {
      structuredContent?: Record<string, unknown>;
    }
  ).structuredContent;

  check('zero stored as zero', afterZero?.price === 0, `price=${JSON.stringify(afterZero?.price)}`);

  // -- Validation -----------------------------------------------------------
  console.log('\nValidation and refusals');
  const noName = await client.callTool({
    name: 'hagamra_create_package',
    arguments: { price: 100 },
  });
  check('create without a name is refused', isError(noName) || textOf(noName).includes('rejected'));

  const badDates = await client.callTool({
    name: 'hagamra_create_package',
    arguments: { name: 'Backwards', start_date: '2027-03-01', end_date: '2027-02-01' },
  });
  check('end before start is refused', isError(badDates), textOf(badDates).split('\n')[0]);

  const noChanges = await client.callTool({
    name: 'hagamra_update_package',
    arguments: { package_id: id },
  });
  check('update with no changes is refused', isError(noChanges));

  // -- Tenant isolation -----------------------------------------------------
  console.log('\nTenant isolation');
  const foreign = await client.callTool({
    name: 'hagamra_get_package',
    arguments: { package_id: 999_999 },
  });
  check('unknown id is not found', isError(foreign) && textOf(foreign).includes('Not found'));

  check(
    'no tool accepts a company parameter',
    !tools.some((tool) =>
      JSON.stringify(tool.inputSchema).includes('company_id'),
    ),
  );

  // -- Clean up -------------------------------------------------------------
  console.log('\nCleanup');
  const deleted = await client.callTool({
    name: 'hagamra_delete_package',
    arguments: { package_id: id },
  });
  check('delete succeeds', !isError(deleted));

  const gone = await client.callTool({
    name: 'hagamra_get_package',
    arguments: { package_id: id },
  });
  check('deleted package is gone', isError(gone));

  await client.close();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('Probe failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
