export type CarryVenueMode = 'simulated' | 'live';

export interface CarryVenueCapabilities {
  venueId: string;
  venueMode: CarryVenueMode;
  executionSupported: boolean;
  supportsIncreaseExposure: boolean;
  supportsReduceExposure: boolean;
  readOnly: boolean;
  approvedForLiveUse: boolean;
  sensitiveExecutionEligible: boolean;
  promotionStatus:
    | 'not_requested'
    | 'pending_review'
    | 'approved'
    | 'rejected'
    | 'suspended';
  promotionBlockedReasons: string[];
  healthy: boolean;
  onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
  missingPrerequisites: string[];
  metadata: Record<string, unknown>;
}
