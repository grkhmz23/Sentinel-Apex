import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCarryExecutionDetail,
  createConnectorPostTradeConfirmationEvidence,
  createConnectorPromotionDetail,
  createConnectorPromotionSummary,
  createConnectorReadinessEvidence,
  createDashboardSession,
  createVenueDetail,
} from './fixtures';

const mockRequireDashboardSession = vi.fn();
const mockLoadVenueDetailPageData = vi.fn();
const mockLoadCarryExecutionDetailPageData = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('../lib/auth.server', () => ({
  requireDashboardSession: mockRequireDashboardSession,
}));

vi.mock('../lib/runtime-api.server', () => ({
  loadVenueDetailPageData: mockLoadVenueDetailPageData,
  loadCarryExecutionDetailPageData: mockLoadCarryExecutionDetailPageData,
}));

describe('phase 6.0 devnet execution dashboard pages', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the explicit execution-capable devnet scope on venue detail', async () => {
    const session = createDashboardSession();
    const detail = createVenueDetail();
    detail.venue.venueId = 'drift-solana-devnet-carry';
    detail.venue.venueName = 'Drift Solana Devnet Carry';
    detail.venue.executionSupport = true;
    detail.venue.metadata = {
      ...detail.venue.metadata,
      executionPosture: 'devnet_execution_capable',
      connectorMode: 'execution_capable_devnet',
      supportedExecutionScope: [
        'devnet only',
        'carry sleeve only',
        'reduce-only BTC-PERP market orders',
      ],
      unsupportedExecutionScope: [
        'mainnet-beta execution',
        'carry increase-exposure execution',
      ],
    };
    detail.promotion = createConnectorPromotionDetail({
      venueId: detail.venue.venueId,
      venueName: detail.venue.venueName,
      connectorType: 'drift_native_devnet_execution',
      current: createConnectorPromotionSummary({
        capabilityClass: 'execution_capable',
        promotionStatus: 'approved',
        effectivePosture: 'approved_for_live',
        approvedForLiveUse: true,
        sensitiveExecutionEligible: true,
      }),
      evidence: createConnectorReadinessEvidence({
        capabilityClass: 'execution_capable',
        eligibleForPromotion: true,
        blockingReasons: [],
        postTradeConfirmation: createConnectorPostTradeConfirmationEvidence({
          status: 'confirmed',
          summary: 'All recent real execution references are fully confirmed by Drift event evidence and venue truth.',
          recentExecutionCount: 1,
          confirmedFullCount: 1,
          latestConfirmedAt: '2026-03-20T12:03:05.000Z',
          entries: [{
            stepId: 'carry-step-1',
            carryExecutionId: 'carry-execution-1',
            carryActionId: 'carry-action-1',
            intentId: 'intent-1',
            clientOrderId: 'intent-1',
            executionReference: 'drift-devnet-sig-1',
            venueId: 'drift-solana-devnet-carry',
            status: 'confirmed_full',
            evidenceBasis: 'event_and_position',
            summary: 'Execution reference drift-devnet-sig-1 has a strong Drift fill match and confirms the full requested 0.010000000 position reduction.',
            evaluatedAt: '2026-03-20T12:03:05.000Z',
            referenceObserved: true,
            referenceObservedAt: '2026-03-20T12:03:05.000Z',
            marketKey: 'perp:1',
            marketSymbol: 'BTC-PERP',
            requestedSize: '0.010000000',
            confirmedSize: '0.010000000',
            remainingSize: '0',
            preTradePositionSide: 'long',
            preTradePositionSize: '0.020000000',
            observedPositionSide: 'long',
            observedPositionSize: '0.010000000',
            eventEvidence: {
              executionReference: 'drift-devnet-sig-1',
              clientOrderId: 'intent-1',
              correlationStatus: 'event_matched_strong',
              deduplicationStatus: 'unique',
              correlationConfidence: 'strong',
              evidenceOrigin: 'raw_and_derived',
              summary: 'Strong Drift fill evidence was attributed to drift-devnet-sig-1.',
              blockedReason: null,
              observedAt: '2026-03-20T12:03:05.000Z',
              eventType: 'OrderActionRecord',
              actionType: 'fill',
              txSignature: 'drift-devnet-sig-1',
              accountAddress: 'devnet-user-account',
              subaccountId: 0,
              marketIndex: 1,
              orderId: '101',
              userOrderId: 11,
              fillBaseAssetAmount: '0.010000000',
              fillQuoteAssetAmount: '500.000000',
              fillRole: 'taker',
              rawEventCount: 2,
              duplicateEventCount: 0,
              rawEvents: [],
            },
            blockedReason: null,
          }],
        }),
      }),
    });
    detail.venue.executionConfirmationState = detail.promotion.evidence.postTradeConfirmation;
    if (detail.snapshots[0] !== undefined) {
      detail.snapshots[0].executionConfirmationState = detail.promotion.evidence.postTradeConfirmation;
    }

    mockRequireDashboardSession.mockResolvedValue(session);
    mockLoadVenueDetailPageData.mockResolvedValue({
      error: null,
      data: {
        detail,
      },
    });

    const VenueDetailPage = (await import('../../app/venues/[venueId]/page')).default;
    render(await VenueDetailPage({ params: { venueId: detail.venue.venueId } }));

    expect(screen.getByText('devnet_execution_capable')).toBeInTheDocument();
    expect(screen.getByText('execution_capable_devnet')).toBeInTheDocument();
    expect(screen.getByText(/reduce-only BTC-PERP market orders/)).toBeInTheDocument();
    expect(screen.getByText(/mainnet-beta execution/)).toBeInTheDocument();
    expect(screen.getAllByText('confirmed').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/All recent real execution references are fully confirmed by Drift event evidence and venue truth/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Strong Drift fill evidence was attributed to drift-devnet-sig-1/)).toBeInTheDocument();
  });

  it('renders real execution modes and signature references on carry execution detail', async () => {
    const session = createDashboardSession();
    const detail = createCarryExecutionDetail();
    detail.execution.executionMode = 'live';
    detail.execution.simulated = false;
    detail.execution.venueExecutionReference = 'drift-devnet-sig-1';
    detail.execution.outcome = {
      executionModes: ['real'],
      orderResults: [{
        executionReference: 'drift-devnet-sig-1',
        executionMode: 'real',
      }],
    };
    const firstStep = detail.steps[0];
    if (firstStep === undefined) {
      throw new Error('Expected carry execution fixture to include a first step.');
    }
    detail.steps[0] = {
      ...firstStep,
      venueId: 'drift-solana-devnet-carry',
      venueMode: 'live',
      onboardingState: 'approved_for_live',
      simulated: false,
      executionReference: 'drift-devnet-sig-1',
      outcome: {
        executionMode: 'real',
      },
      postTradeConfirmation: {
        status: 'confirmed_full',
        evidenceBasis: 'event_and_position',
        summary: 'Execution reference drift-devnet-sig-1 has a strong Drift fill match and confirms the full requested 0.010000000 position reduction.',
        evaluatedAt: '2026-03-20T12:03:05.000Z',
        referenceObserved: true,
        referenceObservedAt: '2026-03-20T12:03:05.000Z',
        marketKey: 'perp:1',
        marketSymbol: 'BTC-PERP',
        requestedSize: '0.010000000',
        confirmedSize: '0.010000000',
        remainingSize: '0',
        preTradePositionSide: 'long',
        preTradePositionSize: '0.020000000',
        observedPositionSide: 'long',
        observedPositionSize: '0.010000000',
        eventEvidence: {
          executionReference: 'drift-devnet-sig-1',
          clientOrderId: firstStep.clientOrderId,
          correlationStatus: 'event_matched_strong',
          deduplicationStatus: 'unique',
          correlationConfidence: 'strong',
          evidenceOrigin: 'raw_and_derived',
          summary: 'Strong Drift fill evidence was attributed to drift-devnet-sig-1.',
          blockedReason: null,
          observedAt: '2026-03-20T12:03:05.000Z',
          eventType: 'OrderActionRecord',
          actionType: 'fill',
          txSignature: 'drift-devnet-sig-1',
          accountAddress: 'devnet-user-account',
          subaccountId: 0,
          marketIndex: 1,
          orderId: '101',
          userOrderId: 11,
          fillBaseAssetAmount: '0.010000000',
          fillQuoteAssetAmount: '500.000000',
          fillRole: 'taker',
          rawEventCount: 2,
          duplicateEventCount: 0,
          rawEvents: [],
        },
        blockedReason: null,
      },
    };

    mockRequireDashboardSession.mockResolvedValue(session);
    mockLoadCarryExecutionDetailPageData.mockResolvedValue({
      error: null,
      data: {
        detail,
      },
    });

    const CarryExecutionDetailPage = (await import('../../app/carry/executions/[executionId]/page')).default;
    render(await CarryExecutionDetailPage({ params: { executionId: detail.execution.id } }));

    expect(screen.getAllByText('real').length).toBeGreaterThan(0);
    expect(screen.getAllByText('drift-devnet-sig-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('confirmed_full').length).toBeGreaterThan(0);
    expect(screen.getByText(/event_matched_strong \/ strong/)).toBeInTheDocument();
  });
});
