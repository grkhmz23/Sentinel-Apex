import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { controlRoutes } from './control.js';
import { eventRoutes } from './events.js';
import { healthRoutes } from './health.js';
import { opportunityRoutes } from './opportunities.js';
import { orderRoutes } from './orders.js';
import { portfolioRoutes } from './portfolio.js';
import { positionRoutes } from './positions.js';
import { riskRoutes } from './risk.js';
import { runtimeRoutes } from './runtime.js';

import type { FastifyInstance } from 'fastify';


/**
 * Registers all route groups on the Fastify instance.
 *
 * Route layout:
 *   GET  /health                               — unauthenticated liveness probe
 *   GET  /api/v1/portfolio                     — portfolio state (auth)
 *   GET  /api/v1/portfolio/snapshots           — historical snapshots (auth)
 *   GET  /api/v1/portfolio/pnl                 — PnL summary (auth)
 *   GET  /api/v1/risk/summary                  — risk metrics (auth)
 *   GET  /api/v1/risk/limits                   — risk limits (auth)
 *   GET  /api/v1/risk/breaches                 — risk breaches (auth)
 *   GET  /api/v1/risk/circuit-breakers         — circuit breaker states (auth)
 *   GET  /api/v1/orders                        — list orders (auth)
 *   GET  /api/v1/orders/:clientOrderId         — single order (auth)
 *   GET  /api/v1/positions                     — list positions (auth)
 *   GET  /api/v1/positions/:id                 — single position (auth)
 *   GET  /api/v1/opportunities                 — list opportunities (auth)
 *   POST /api/v1/control/kill-switch           — halt execution (auth)
 *   POST /api/v1/control/resume                — resume execution (auth)
 *   GET  /api/v1/control/mode                  — current mode (auth)
 *   POST /api/v1/control/mode                  — change mode (auth, dry-run only)
 */
export async function registerRoutes(
  app: FastifyInstance,
  runtime: SentinelRuntime,
): Promise<void> {
  // Unauthenticated
  await app.register(healthRoutes);

  // Authenticated API routes
  await portfolioRoutes(app, runtime);
  await riskRoutes(app, runtime);
  await orderRoutes(app, runtime);
  await positionRoutes(app, runtime);
  await opportunityRoutes(app, runtime);
  await eventRoutes(app, runtime);
  await runtimeRoutes(app, runtime);
  await controlRoutes(app, runtime);
}
