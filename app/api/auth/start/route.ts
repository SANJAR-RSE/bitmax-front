import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PAIR_COOKIE, isSameOrigin, publicBackendFetch, sessionCookieOptions } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/**
 * Opens a login pairing request, or resumes the one this browser already holds. The pairing
 * token lives in an httpOnly cookie rather than in the page: the browser needs to *poll* with
 * it, not to read it, and a token sitting in JavaScript is a token an injected script can carry
 * off and redeem elsewhere.
 *
 * Resuming matters because the login page starts a pairing on every visit. Without it each
 * reload opened a fresh request: it used up the per-visitor start limit and replaced the code
 * the user was about to compare in the bot with a new one.
 */
export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: 'So‘rov rad etildi' }, { status: 403 });
  }

  try {
    const held = (await cookies()).get(PAIR_COOKIE)?.value;
    if (held) {
      const resumed = await publicBackendFetch('/api/auth/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: held }),
      });
      if (resumed.ok) return pairingResponse(await resumed.json());
      // Anything else (expired, approved, denied, unknown): fall through to a fresh request.
    }

    const upstream = await publicBackendFetch('/api/auth/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forwarded so the approval message in the bot can describe the device asking.
        'user-agent': request.headers.get('user-agent') || '',
      },
      body: '{}',
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json({ error: data?.error || 'Xatolik yuz berdi' }, { status: upstream.status });
    }
    return pairingResponse(data);
  } catch {
    return NextResponse.json({ error: 'Server bilan bog‘lanib bo‘lmadi' }, { status: 502 });
  }
}

function pairingResponse(data: { token: string; pairCode: string; deepLink: string; expiresAt: string }) {
  const response = NextResponse.json({
    pairCode: data.pairCode,
    deepLink: data.deepLink,
    expiresAt: data.expiresAt,
  });
  // The cookie lives exactly as long as the request it points to.
  const secondsLeft = Math.max(1, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
  response.cookies.set(PAIR_COOKIE, data.token, sessionCookieOptions(Math.min(secondsLeft, 10 * 60)));
  return response;
}
