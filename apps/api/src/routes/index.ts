import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

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
 *   POST /api/v1/runtime/reconciliation/run    — queue explicit reconciliation run (auth)
 *   GET  /api/v1/runtime/reconciliation/runs   — reconciliation runs (auth)
 *   GET  /api/v1/runtime/reconciliation/runs/:id — reconciliation run detail (auth)
 *   GET  /api/v1/runtime/reconciliation/findings — reconciliation findings (auth)
 *   GET  /api/v1/runtime/reconciliation/findings/:id — reconciliation finding detail (auth)
 *   GET  /api/v1/runtime/reconciliation/summary — latest reconciliation summary (auth)
 *   GET  /api/v1/runtime/mismatches            — list mismatches (auth)
 *   GET  /api/v1/runtime/mismatches/summary    — mismatch status counts (auth)
 *   GET  /api/v1/runtime/mismatches/:id        — mismatch detail with recovery history (auth)
 *   GET  /api/v1/runtime/mismatches/:id/findings — mismatch reconciliation findings (auth)
 *   GET  /api/v1/runtime/recovery-events      — recovery event history (auth)
 *   GET  /api/v1/runtime/recovery-outcomes    — recovery outcome history (auth)
 *   GET  /api/v1/runtime/commands             — recent runtime commands (auth)
 *   GET  /api/v1/runtime/worker               — worker state (auth)
 *   GET  /api/v1/runtime/commands/:id         — single runtime command (auth)
 *   POST /api/v1/runtime/mismatches/:id/acknowledge — acknowledge mismatch (auth)
 *   POST /api/v1/runtime/mismatches/:id/recover     — start recovery workflow (auth)
 *   POST /api/v1/runtime/mismatches/:id/resolve     — resolve mismatch (auth)
 *   POST /api/v1/runtime/mismatches/:id/verify      — verify mismatch or fail verification (auth)
 *   POST /api/v1/runtime/mismatches/:id/reopen      — reopen mismatch (auth)
 *   POST /api/v1/control/kill-switch           — halt execution (auth)
 *   POST /api/v1/control/resume                — resume execution (auth)
 *   GET  /api/v1/control/mode                  — current mode (auth)
 *   POST /api/v1/control/mode                  — change mode (auth, dry-run only)
 */
export async function registerRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  // Unauthenticated
  await app.register(healthRoutes);

  // Authenticated API routes
  await portfolioRoutes(app, controlPlane);
  await riskRoutes(app, controlPlane);
  await orderRoutes(app, controlPlane);
  await positionRoutes(app, controlPlane);
  await opportunityRoutes(app, controlPlane);
  await eventRoutes(app, controlPlane);
  await runtimeRoutes(app, controlPlane);
  await controlRoutes(app, controlPlane);
}
