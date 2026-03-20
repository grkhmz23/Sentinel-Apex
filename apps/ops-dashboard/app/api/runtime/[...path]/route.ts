import { NextResponse } from 'next/server';

import { getDashboardApiBaseUrl, getDashboardApiKey } from '../../../../src/lib/env.server';

import type { NextRequest } from 'next/server';

function buildTargetUrl(request: NextRequest, path: string[]): string {
  const target = new URL(`${getDashboardApiBaseUrl()}/api/v1/runtime/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  return target.toString();
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const body = request.method === 'GET' ? null : await request.text();
  const response = await fetch(buildTargetUrl(request, path), {
    method: request.method,
    headers: {
      'content-type': 'application/json',
      'x-api-key': getDashboardApiKey(),
    },
    ...(body !== null ? { body } : {}),
    cache: 'no-store',
  });

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } },
): Promise<NextResponse> {
  return proxyRequest(request, context.params.path);
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } },
): Promise<NextResponse> {
  return proxyRequest(request, context.params.path);
}
