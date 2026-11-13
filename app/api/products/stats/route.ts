import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Landing-page counters. This used to be served only by the catch-all rewrite in
 * next.config.js, whose destination is fixed when the site is built; a handler reads
 * BACKEND_URL at request time like every other route here.
 */
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/products/stats`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(25000),
      next: { revalidate: 60 },
    });
    const data = await res.json().catch(() => null);
    if (!data) return NextResponse.json({ error: 'Statistika vaqtincha mavjud emas' }, { status: 502 });
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Statistika vaqtincha mavjud emas' }, { status: 502 });
  }
}
