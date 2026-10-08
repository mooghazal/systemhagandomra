import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // probe.ts is the end-to-end check and needs a running backend, so it is
    // driven on its own rather than from the unit suite.
    include: ['src/**/*.test.ts'],
  },
});
