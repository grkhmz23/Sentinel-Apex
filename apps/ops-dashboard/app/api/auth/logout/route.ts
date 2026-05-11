import { NextResponse } from 'next/server';

import {
  getClearedSessionCookieOptions,
  revokeDashboardSessionByToken,
} from '../../../../src/lib/auth.server';
import { getSessionCookieName } from '../../../../src/lib/env.server';
import { rejectInvalidMutatingOrigin } from '../../../../src/lib/request-security.server';

import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rejected = rejectInvalidMutatingOrigin(request);
  if (rejected !== null) {
    return rejected;
  }

  const token = request.cookies.get(getSessionCookieName())?.value ?? null;
  if (token !== null) {
    await revokeDashboardSessionByToken(token);
  }

  const response = NextResponse.redirect(new URL('/sign-in', request.url), { status: 303 });
  response.cookies.set(getSessionCookieName(), '', getClearedSessionCookieOptions());
  return response;
}
