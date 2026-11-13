import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextConfig = require('../next.config.js');

test('the backend rewrite never shadows a route handler', async () => {
  // `beforeFiles` and `afterFiles` both run before dynamic routes such as /api/products/[id],
  // which silently bypassed that handler and used the build-time BACKEND_URL instead.
  const rewrites = await nextConfig.rewrites();
  assert.ok(!Array.isArray(rewrites), 'rewrites are phased, not a bare array (that means afterFiles)');
  assert.deepEqual(rewrites.beforeFiles ?? [], []);
  assert.deepEqual(rewrites.afterFiles ?? [], []);
  assert.ok(rewrites.fallback.some((r: any) => r.source === '/api/products/:path*'));
});

test('every backend endpoint the site calls has its own handler, so none depends on the build-time URL', async () => {
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = join(process.cwd(), 'app', 'api', 'products');
  for (const route of ['route.ts', 'categories/route.ts', 'policy/route.ts', 'stats/route.ts', '[id]/route.ts']) {
    assert.ok(existsSync(join(root, route)), `missing handler app/api/products/${route}`);
  }
});

test('nothing under /api/me is ever rewritten past the authenticating proxy', async () => {
  const rewrites = await nextConfig.rewrites();
  const all = [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? []), ...(rewrites.fallback ?? [])];
  assert.ok(all.every((r: any) => !r.source.startsWith('/api/me')));
});
