// =============================================================================
// Portfolio state tracker — in-memory PortfolioState built from venue data
// =============================================================================

import Decimal from 'decimal.js';

import type { OrderFill, OrderIntent } from '@sentinel-apex/domain';
import type { Logger } from '@sentinel-apex/observability';
import type { PortfolioState } from '@sentinel-apex/risk-engine';
import type { VenueAdapter } from '@sentinel-apex/venue-adapters';

// ── PortfolioStateTracker ─────────────────────────────────────────────────────

/**
 * Tracks live portfolio state in memory by aggregating across all venue adapters.
 *
 * In a full implementation this would be backed by a persistent database;
 * this in-memory version is suitable for paper trading and integration tests.
 */
export class PortfolioStateTracker {
  private currentState: PortfolioState;

  constructor(
    private readonly adapters: Map<string, VenueAdapter>,
    private readonly logger: Logger,
    /** The sleeve ID associated with this tracker instance. */
    private readonly sleeveId: string = 'carry',
  ) {
    // Initialise with an empty safe state
    this.currentState = PortfolioStateTracker.emptyState();
  }

  // ── Static helpers ─────────────────────────────────────────────────────────

  private static emptyState(): PortfolioState {
    return {
      totalNav: '0',
      grossExposure: '0',
      netExposure: '0',
      liquidityReserve: '0',
      currentDailyDrawdownPct: 0,
      currentWeeklyDrawdownPct: 0,
      currentPortfolioDrawdownPct: 0,
      venueExposures: new Map(),
      assetExposures: new Map(),
      sleeveNav: new Map(),
      openPositionCount: 0,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Rebuild portfolio state by querying all venue adapters.
   *
   * Aggregates:
   *   - Balance totals → totalNav and liquidityReserve
   *   - Open positions → grossExposure, netExposure, per-venue / per-asset exposures
   *   - Position count → openPositionCount
   */
  async refresh(): Promise<PortfolioState> {
    let totalNavD = new Decimal(0);
    let grossExposureD = new Decimal(0);
    let netExposureD = new Decimal(0);
    let totalLiquidityD = new Decimal(0);
    let openPositionCount = 0;

    const venueExposures = new Map<string, string>();
    const assetExposures = new Map<string, string>();

    for (const [venueId, adapter] of this.adapters) {
      try {
        // ── Balances ────────────────────────────────────────────────────────
        const balances = await adapter.getBalances();
        let venueBalanceUsd = new Decimal(0);

        for (const bal of balances) {
          // Treat USDC/USDT/USD as 1:1 quote currency; other assets need price lookup
          if (['USDC', 'USDT', 'USD'].includes(bal.asset)) {
            venueBalanceUsd = venueBalanceUsd.plus(new Decimal(bal.total));
            totalLiquidityD = totalLiquidityD.plus(new Decimal(bal.available));
          }
          // Non-stablecoin balances are omitted here for simplicity;
          // a production tracker would fetch mark prices for each asset.
        }

        totalNavD = totalNavD.plus(venueBalanceUsd);

        // ── Positions ───────────────────────────────────────────────────────
        const positions = await adapter.getPositions();

        let venueExposureD = new Decimal(venueExposures.get(venueId) ?? '0');

        for (const pos of positions) {
          // Estimate notional from size × markPrice
          let markPriceD: Decimal;
          try {
            const md = await adapter.getMarketData(pos.asset);
            markPriceD = new Decimal(md.markPrice);
          } catch {
            markPriceD = new Decimal(pos.markPrice);
          }

          const notionalD = new Decimal(pos.size).times(markPriceD);
          grossExposureD = grossExposureD.plus(notionalD);

          const deltaD = pos.side === 'long' ? notionalD : notionalD.negated();
          netExposureD = netExposureD.plus(deltaD);

          venueExposureD = venueExposureD.plus(notionalD);

          const currentAssetExposure = new Decimal(assetExposures.get(pos.asset) ?? '0');
          assetExposures.set(pos.asset, currentAssetExposure.plus(notionalD).toFixed());

          openPositionCount++;
        }

        venueExposures.set(venueId, venueExposureD.toFixed());
      } catch (error) {
        this.logger.warn('PortfolioStateTracker.refresh: failed to query adapter', {
          venueId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Add gross exposure to NAV as positions are on-margin
    totalNavD = totalNavD.plus(grossExposureD);

    const sleeveNav = new Map<string, string>([[this.sleeveId, totalNavD.toFixed()]]);

    const newState: PortfolioState = {
      totalNav: totalNavD.toFixed(),
      grossExposure: grossExposureD.toFixed(),
      netExposure: netExposureD.toFixed(),
      liquidityReserve: totalLiquidityD.toFixed(),
      currentDailyDrawdownPct: 0,
      currentWeeklyDrawdownPct: 0,
      currentPortfolioDrawdownPct: 0,
      venueExposures,
      assetExposures,
      sleeveNav,
      openPositionCount,
    };

    this.currentState = newState;

    this.logger.debug('PortfolioStateTracker.refresh: state updated', {
      totalNav: totalNavD.toFixed(),
      grossExposure: grossExposureD.toFixed(),
      openPositionCount,
    });

    return newState;
  }

  /**
   * Get the last refreshed portfolio state.
   * Returns the empty state if refresh has never been called.
   */
  getState(): PortfolioState {
    return this.currentState;
  }

  /**
   * Optimistically apply a fill to the in-memory state.
   *
   * Updates gross exposure, net exposure, and open position count so that
   * the state remains reasonably accurate between full refresh cycles.
   */
  applyFill(fill: OrderFill, intent: OrderIntent): void {
    const fillPrice = new Decimal(fill.fillPrice);
    const fillSize = new Decimal(fill.filledSize);
    const notionalUsd = fillPrice.times(fillSize);

    const isLong = intent.side === 'buy';
    const deltaUsd = isLong ? notionalUsd : notionalUsd.negated();

    const current = this.currentState;

    const newGross = new Decimal(current.grossExposure).plus(notionalUsd);
    const newNet = new Decimal(current.netExposure).plus(deltaUsd);
    const newLiquidity = new Decimal(current.liquidityReserve).minus(notionalUsd);

    // Update per-venue exposure
    const updatedVenueExposures = new Map(current.venueExposures);
    const venueCurrentD = new Decimal(updatedVenueExposures.get(intent.venueId) ?? '0');
    updatedVenueExposures.set(intent.venueId, venueCurrentD.plus(notionalUsd).toFixed());

    // Update per-asset exposure
    const updatedAssetExposures = new Map(current.assetExposures);
    const assetCurrentD = new Decimal(updatedAssetExposures.get(intent.asset) ?? '0');
    updatedAssetExposures.set(intent.asset, assetCurrentD.plus(notionalUsd).toFixed());

    this.currentState = {
      ...current,
      grossExposure: newGross.toFixed(),
      netExposure: newNet.toFixed(),
      liquidityReserve: Decimal.max(newLiquidity, new Decimal(0)).toFixed(),
      venueExposures: updatedVenueExposures,
      assetExposures: updatedAssetExposures,
      openPositionCount: current.openPositionCount + 1,
    };

    this.logger.debug('PortfolioStateTracker.applyFill: optimistic state updated', {
      fillId: fill.fillId,
      intentId: intent.intentId,
      notionalUsd: notionalUsd.toFixed(),
    });
  }
}
