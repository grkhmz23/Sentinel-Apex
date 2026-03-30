import type {
  AllocatorSleeveDefinition,
  AllocatorSleeveId,
} from './types.js';

const DEFAULT_SLEEVES: AllocatorSleeveDefinition[] = [
  {
    sleeveId: 'carry',
    kind: 'carry',
    name: 'Apex Carry',
    reserveManaged: false,
    executionMode: 'dry-run',
    supportsAllocatorBudgeting: true,
  },
  {
    sleeveId: 'treasury',
    kind: 'treasury',
    name: 'Atlas Treasury',
    reserveManaged: true,
    executionMode: 'dry-run',
    supportsAllocatorBudgeting: true,
  },
];

export class SentinelSleeveRegistry {
  constructor(
    private readonly sleeves: AllocatorSleeveDefinition[] = DEFAULT_SLEEVES,
  ) {}

  list(): AllocatorSleeveDefinition[] {
    return [...this.sleeves];
  }

  get(sleeveId: AllocatorSleeveId): AllocatorSleeveDefinition {
    const sleeve = this.sleeves.find((candidate) => candidate.sleeveId === sleeveId);
    if (sleeve === undefined) {
      throw new Error(`Unknown Sentinel sleeve "${sleeveId}".`);
    }

    return sleeve;
  }
}
