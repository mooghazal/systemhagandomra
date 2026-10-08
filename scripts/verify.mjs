#!/usr/bin/env node

/**
 * Everything CI runs, in one command, locally.
 *
 * `npm run verify`
 *
 * It exists so that finding out a change broke something does not require
 * pushing first. Steps run in the cheapest-first order — lint before tests,
 * tests before builds — and the run stops at the first failure, because the
 * second error is usually the first one wearing a different hat.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const steps = [
  { name: 'lint',              command: 'npm',  args: ['run', 'lint'] },
  { name: 'frontend tests',    command: 'npm',  args: ['test'] },
  { name: 'admin panel build', command: 'npm',  args: ['run', 'build', '--workspace=admin-panel'] },
  { name: 'company build',     command: 'npm',  args: ['run', 'build', '--workspace=company-dashboard'] },
  { name: 'mcp server build',  command: 'npm',  args: ['run', 'build', '--workspace=mcp-server'] },
  { name: 'laravel tests',     command: 'php',  args: ['artisan', 'test'], cwd: join(root, 'backend') },
];

const label = (text) => `\u001b[1m${text}\u001b[0m`;
const green = (text) => `\u001b[32m${text}\u001b[0m`;
const red = (text) => `\u001b[31m${text}\u001b[0m`;

const started = Date.now();

for (const [index, step] of steps.entries()) {
  process.stdout.write(`\n${label(`[${index + 1}/${steps.length}] ${step.name}`)}\n`);

  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd ?? root,
    stdio: 'inherit',
    // npm and php are batch files on Windows, which cannot be executed
    // without a shell.
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.stdout.write(`\n${red(`✗ ${step.name} failed.`)} Nothing after this ran.\n`);
    process.exit(result.status ?? 1);
  }
}

const seconds = Math.round((Date.now() - started) / 1000);

process.stdout.write(`\n${green('✓ everything passed')} in ${seconds}s\n`);
