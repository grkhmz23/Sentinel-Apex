import { NextResponse } from 'next/server';

import { getDashboardOrigin, isProductionEnv } from './env.server';

import type { NextRequest } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

function originFromHeader(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function requestOrigin(request: NextRequest): string | null {
  return originFromHeader(request.headers.get('origin'))
    ?? originFromHeader(request.headers.get('referer'));
}

export function rejectInvalidMutatingOrigin(request: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const expectedOrigin = getDashboardOrigin(request.nextUrl.origin);
  const actualOrigin = requestOrigin(request);

  if (actualOrigin === null) {
    if (isProductionEnv()) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'Origin or Referer header is required for mutating dashboard requests.',
        },
      }, { status: 403 });
    }
    return null;
  }

  if (actualOrigin !== expectedOrigin) {
    return NextResponse.json({
      error: {
        code: 'FORBIDDEN',
        message: 'Mutating dashboard request origin is not allowed.',
      },
    }, { status: 403 });
  }

  return null;
}
