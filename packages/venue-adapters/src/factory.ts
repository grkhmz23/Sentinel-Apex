// =============================================================================
// VenueAdapter factory — selects implementation based on runtime mode
// =============================================================================

import {
  SimulatedVenueAdapter,
  type SimulatedVenueConfig,
} from './simulation/simulated-venue-adapter.js';

import type { VenueAdapter } from './interfaces/venue-adapter.js';


export interface VenueAdapterConfig {
  mode: 'dry-run' | 'live';
  venueId: string;
  simulationConfig?: SimulatedVenueConfig;
}

/**
 * Create a VenueAdapter for the given config.
 *
 * In dry-run mode a SimulatedVenueAdapter is always returned.
 * In live mode the factory delegates to a registered live adapter; if none is
 * found it throws so that callers never accidentally paper-trade in production.
 */
export function createVenueAdapter(config: VenueAdapterConfig): VenueAdapter {
  if (config.mode === 'dry-run') {
    if (config.simulationConfig === undefined) {
      throw new Error(
        `createVenueAdapter: simulationConfig is required for dry-run mode (venueId="${config.venueId}")`,
      );
    }
    return new SimulatedVenueAdapter(config.simulationConfig);
  }

  // Live mode: check the registry for a factory function
  const liveFactory = _liveAdapterRegistry.get(config.venueId);
  if (liveFactory === undefined) {
    throw new Error(
      `createVenueAdapter: no live adapter registered for venueId="${config.venueId}". ` +
        `Register one via registerLiveAdapter() before calling createVenueAdapter in live mode.`,
    );
  }

  return liveFactory(config);
}

// ---------------------------------------------------------------------------
// Live adapter registration — kept in this module to avoid circular imports
// ---------------------------------------------------------------------------

type LiveAdapterFactory = (config: VenueAdapterConfig) => VenueAdapter;

const _liveAdapterRegistry = new Map<string, LiveAdapterFactory>();

/**
 * Register a factory function for a given live venue.
 * This allows external packages (e.g. a venue-specific adapter) to plug in without
 * modifying this file.
 */
export function registerLiveAdapter(venueId: string, factory: LiveAdapterFactory): void {
  _liveAdapterRegistry.set(venueId, factory);
}
