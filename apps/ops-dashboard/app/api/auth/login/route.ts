import { NextResponse } from 'next/server';

import {
  authenticateOperatorCredentials,
  createDashboardSession,
  getSessionCookieOptions,
} from '../../../../src/lib/auth.server';
import { getSessionCookieName } from '../../../../src/lib/env.server';

import type { NextRequest } from 'next/server';

function getSafeRedirectPath(value: string | null): string {
  if (value !== null && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return '/';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const nextPath = getSafeRedirectPath(String(formData.get('next') ?? '/'));

  const operator = await authenticateOperatorCredentials(email, password);
  if (operator === null) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=invalid_credentials&next=${encodeURIComponent(nextPath)}`, request.url),
      { status: 303 },
    );
  }

  const { session, token } = await createDashboardSession(operator.operatorId);
  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
  response.cookies.set(getSessionCookieName(), token, getSessionCookieOptions(session.expiresAt));
  return response;
}
