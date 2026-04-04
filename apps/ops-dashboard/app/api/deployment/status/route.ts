import { NextResponse } from 'next/server';

import { getDashboardDeploymentProfile } from '../../../../src/lib/deployment';
import { getDashboardApiBaseUrl } from '../../../../src/lib/env.server';

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text === '' ? null : JSON.parse(text) as unknown;
}

export async function GET(): Promise<NextResponse> {
  try {
    const profile = getDashboardDeploymentProfile();
    const backendBaseUrl = getDashboardApiBaseUrl();

    const [healthResponse, readyResponse] = await Promise.all([
      fetch(`${backendBaseUrl}/health`, { cache: 'no-store' }),
      fetch(`${backendBaseUrl}/readyz`, { cache: 'no-store' }),
    ]);

    return NextResponse.json({
      status: 'ok',
      frontend: {
        app: 'ops-dashboard',
        environmentLabel: profile.environmentLabel,
        executionBadge: profile.executionBadge,
        supportedExecutionScope: profile.supportedExecutionScope,
        blockedExecutionScope: profile.blockedExecutionScope,
        readinessTruth: profile.readinessTruth,
      },
      backend: {
        baseUrl: backendBaseUrl,
        health: {
          statusCode: healthResponse.status,
          payload: await parseJson(healthResponse),
        },
        readiness: {
          statusCode: readyResponse.status,
          payload: await parseJson(readyResponse),
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'misconfigured',
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString(),
    }, { status: 500 });
  }
}
