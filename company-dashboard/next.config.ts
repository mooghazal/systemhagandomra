import path from 'node:path';

import type { NextConfig } from 'next';

import { SECURITY_HEADERS } from '@hagamra/shared/lib/security-headers';

const nextConfig: NextConfig = {
  /*
   * `cacheComponents` is deliberately off.
   *
   * It is built for sites with content worth prerendering and caching. This
   * panel has none: every page sits behind a session cookie and shows data
   * belonging to whoever is signed in, so each route is dynamic by nature.
   * Leaving it on would mean marking every single route as uncacheable one by
   * one — noise in exchange for nothing, and a real risk that one page
   * eventually gets cached and serves one tenant's data to another.
   */
  cacheComponents: false,

  /*
   * The shared workspace package ships TypeScript source rather than a build
   * artifact — there is no compile step between the two, so an edit there is
   * picked up here immediately. Next compiles it alongside the app.
   */
  transpilePackages: ['@hagamra/shared'],

  turbopack: {
    /*
     * The monorepo root. npm workspaces hoist dependencies there, and the
     * shared package lives there too, so Turbopack has to treat it as the
     * boundary — it refuses to compile anything outside the root it infers.
     */
    root: path.join(__dirname, '..'),

    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },

  // The backend's error messages are the only ones clients should see; this
  // keeps Next's own stack traces out of production responses.
  poweredByHeader: false,

  /*
   * Applied to every response, including the API routes that proxy to Laravel
   * and the 404 page — anything the browser can be pointed at.
   */
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
