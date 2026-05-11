import { NextResponse } from 'next/server';

import {
  authenticateOperatorCredentials,
  createDashboardSession,
  getSessionCookieOptions,
} from '../../../../src/lib/auth.server';
import { getSessionCookieName } from '../../../../src/lib/env.server';
import { rejectInvalidMutatingOrigin } from '../../../../src/lib/request-security.server';

import type { NextRequest } from 'next/server';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

interface LoginAttemptBucket {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LoginAttemptBucket>();

function getSafeRedirectPath(value: string | null): string {
  if (value !== null && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return '/';
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor !== null && forwardedFor.trim() !== '') {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function loginAttemptKey(email: string, request: NextRequest): string {
  return `${email}:${getClientIp(request)}`;
}

function getActiveBucket(key: string, now = Date.now()): LoginAttemptBucket {
  const existing = loginAttempts.get(key);
  if (existing === undefined || existing.resetAt <= now) {
    const created = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(key, created);
    return created;
  }
  return existing;
}

function isRateLimited(key: string): boolean {
  return getActiveBucket(key).count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(key: string): void {
  const bucket = getActiveBucket(key);
  bucket.count += 1;
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rejected = rejectInvalidMutatingOrigin(request);
  if (rejected !== null) {
    return rejected;
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const nextPath = getSafeRedirectPath(String(formData.get('next') ?? '/'));
  const attemptKey = loginAttemptKey(email, request);

  if (isRateLimited(attemptKey)) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=rate_limited&next=${encodeURIComponent(nextPath)}`, request.url),
      { status: 303 },
    );
  }

  const operator = await authenticateOperatorCredentials(email, password);
  if (operator === null) {
    recordFailedLogin(attemptKey);
    return NextResponse.redirect(
      new URL(`/sign-in?error=invalid_credentials&next=${encodeURIComponent(nextPath)}`, request.url),
      { status: 303 },
    );
  }

  clearLoginAttempts(attemptKey);
  const { session, token } = await createDashboardSession(operator.operatorId);
  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
  response.cookies.set(getSessionCookieName(), token, getSessionCookieOptions(session.expiresAt));
  return response;
}
