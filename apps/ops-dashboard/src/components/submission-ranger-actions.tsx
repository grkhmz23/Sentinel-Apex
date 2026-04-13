'use client';

import { useState } from 'react';

import type {
  RangerAccountMetaInput,
  SubmissionCluster,
  SubmissionDossierView,
} from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import { useOptionalRefresh } from '../lib/navigation-hooks';
import {
  addRangerAdaptor,
  createRangerLpMetadata,
  createRangerVault,
  depositRangerStrategy,
  initializeRangerStrategy,
  withdrawRangerStrategy,
} from '../lib/runtime-api.client';

interface SubmissionRangerActionsProps {
  dossier: SubmissionDossierView;
}

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

interface StrategyOperationFormState {
  vaultId: string;
  strategyAddress: string;
  amount: string;
  vaultAssetMint: string;
  adaptorProgramId: string;
  instructionDiscriminatorHex: string;
  additionalArgsHex: string;
  remainingAccountsJson: string;
}

function createMutationState(): MutationState {
  return {
    loading: false,
    error: null,
    success: null,
  };
}

function parseRemainingAccounts(input: string): RangerAccountMetaInput[] {
  if (input.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(
      `Remaining accounts must be valid JSON. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Remaining accounts JSON must be an array.');
  }

  return parsed.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(`Remaining accounts entry ${index + 1} must be an object.`);
    }

    const record = item as Record<string, unknown>;
    const pubkey = record['pubkey'];
    const isSigner = record['isSigner'];
    const isWritable = record['isWritable'];

    if (typeof pubkey !== 'string' || pubkey.trim().length === 0) {
      throw new Error(`Remaining accounts entry ${index + 1} is missing a pubkey.`);
    }
    if (typeof isSigner !== 'boolean' || typeof isWritable !== 'boolean') {
      throw new Error(
        `Remaining accounts entry ${index + 1} must include boolean isSigner and isWritable fields.`,
      );
    }

    return {
      pubkey: pubkey.trim(),
      isSigner,
      isWritable,
    };
  });
}

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function clusterValue(cluster: SubmissionCluster): SubmissionCluster {
  return cluster === 'devnet' || cluster === 'mainnet-beta' ? cluster : 'devnet';
}

export function SubmissionRangerActions(
  { dossier }: SubmissionRangerActionsProps,
): JSX.Element {
  const refresh = useOptionalRefresh();
  const { canOperate, isAdmin } = useOperator();

  const [createVaultForm, setCreateVaultForm] = useState({
    assetMint: '',
    name: dossier.vaultName.slice(0, 32),
    description: dossier.strategyName.slice(0, 64),
    maxCap: '',
    strategyId: dossier.strategyId,
    strategyMetadataUri: '',
    lpTokenName: dossier.vaultName.slice(0, 32),
    lpTokenSymbol: 'APEXLP',
    managerPublicKey: dossier.managerWalletAddress ?? '',
    cluster: clusterValue(dossier.cluster),
  });
  const [lpMetadataForm, setLpMetadataForm] = useState({
    vaultId: dossier.rangerVaultAddress ?? '',
    name: dossier.vaultName.slice(0, 32),
    symbol: 'APEXLP',
    uri: dossier.rangerLpMetadataUri ?? '',
  });
  const [adaptorForm, setAdaptorForm] = useState({
    vaultId: dossier.rangerVaultAddress ?? '',
    adaptorProgramId: dossier.rangerAdaptorProgramId ?? '',
  });
  const [strategyForm, setStrategyForm] = useState({
    vaultId: dossier.rangerVaultAddress ?? '',
    strategyAddress: dossier.rangerStrategyAddress ?? '',
    adaptorProgramId: dossier.rangerAdaptorProgramId ?? '',
    instructionDiscriminatorHex: '',
    additionalArgsHex: '',
    remainingAccountsJson: '[]',
  });
  const [depositForm, setDepositForm] = useState<StrategyOperationFormState>({
    vaultId: dossier.rangerVaultAddress ?? '',
    strategyAddress: dossier.rangerStrategyAddress ?? '',
    amount: '',
    vaultAssetMint: '',
    adaptorProgramId: dossier.rangerAdaptorProgramId ?? '',
    instructionDiscriminatorHex: '',
    additionalArgsHex: '',
    remainingAccountsJson: '[]',
  });
  const [withdrawForm, setWithdrawForm] = useState<StrategyOperationFormState>({
    vaultId: dossier.rangerVaultAddress ?? '',
    strategyAddress: dossier.rangerStrategyAddress ?? '',
    amount: '',
    vaultAssetMint: '',
    adaptorProgramId: dossier.rangerAdaptorProgramId ?? '',
    instructionDiscriminatorHex: '',
    additionalArgsHex: '',
    remainingAccountsJson: '[]',
  });

  const [createVaultState, setCreateVaultState] = useState<MutationState>(createMutationState());
  const [lpMetadataState, setLpMetadataState] = useState<MutationState>(createMutationState());
  const [adaptorState, setAdaptorState] = useState<MutationState>(createMutationState());
  const [strategyState, setStrategyState] = useState<MutationState>(createMutationState());
  const [depositState, setDepositState] = useState<MutationState>(createMutationState());
  const [withdrawState, setWithdrawState] = useState<MutationState>(createMutationState());

  async function handleCreateVault(): Promise<void> {
    setCreateVaultState(createMutationState());
    setCreateVaultState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const strategyMetadataUri = normalizeOptional(createVaultForm.strategyMetadataUri);
      const lpTokenName = normalizeOptional(createVaultForm.lpTokenName);
      const lpTokenSymbol = normalizeOptional(createVaultForm.lpTokenSymbol);
      const managerPublicKey = normalizeOptional(createVaultForm.managerPublicKey);
      const result = await createRangerVault({
        assetMint: createVaultForm.assetMint.trim(),
        name: createVaultForm.name.trim(),
        description: createVaultForm.description.trim(),
        maxCap: createVaultForm.maxCap.trim(),
        strategyId: createVaultForm.strategyId.trim(),
        ...(strategyMetadataUri !== undefined ? { strategyMetadataUri } : {}),
        ...(lpTokenName !== undefined ? { lpTokenName } : {}),
        ...(lpTokenSymbol !== undefined ? { lpTokenSymbol } : {}),
        ...(managerPublicKey !== undefined ? { managerPublicKey } : {}),
        cluster: createVaultForm.cluster,
        updateSubmissionDossier: true,
      });

      setCreateVaultState({
        loading: false,
        error: null,
        success: `Vault created at ${result.vaultAddress}.`,
      });
      refresh();
    } catch (error) {
      setCreateVaultState({
        loading: false,
        error: error instanceof Error ? error.message : 'Vault creation failed.',
        success: null,
      });
    }
  }

  async function handleCreateLpMetadata(): Promise<void> {
    setLpMetadataState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const result = await createRangerLpMetadata({
        vaultId: lpMetadataForm.vaultId.trim(),
        name: lpMetadataForm.name.trim(),
        symbol: lpMetadataForm.symbol.trim(),
        uri: lpMetadataForm.uri.trim(),
        updateSubmissionDossier: true,
      });

      setLpMetadataState({
        loading: false,
        error: null,
        success: `LP metadata submitted. Signature: ${result.signature}`,
      });
      refresh();
    } catch (error) {
      setLpMetadataState({
        loading: false,
        error: error instanceof Error ? error.message : 'LP metadata creation failed.',
        success: null,
      });
    }
  }

  async function handleAddAdaptor(): Promise<void> {
    setAdaptorState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const result = await addRangerAdaptor({
        vaultId: adaptorForm.vaultId.trim(),
        adaptorProgramId: adaptorForm.adaptorProgramId.trim(),
        updateSubmissionDossier: true,
      });

      setAdaptorState({
        loading: false,
        error: null,
        success: `Adaptor added. Signature: ${result.signature}`,
      });
      refresh();
    } catch (error) {
      setAdaptorState({
        loading: false,
        error: error instanceof Error ? error.message : 'Adaptor addition failed.',
        success: null,
      });
    }
  }

  async function handleInitializeStrategy(): Promise<void> {
    setStrategyState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const adaptorProgramId = normalizeOptional(strategyForm.adaptorProgramId);
      const instructionDiscriminatorHex = normalizeOptional(strategyForm.instructionDiscriminatorHex);
      const additionalArgsHex = normalizeOptional(strategyForm.additionalArgsHex);
      const result = await initializeRangerStrategy({
        vaultId: strategyForm.vaultId.trim(),
        strategyAddress: strategyForm.strategyAddress.trim(),
        ...(adaptorProgramId !== undefined ? { adaptorProgramId } : {}),
        ...(instructionDiscriminatorHex !== undefined ? { instructionDiscriminatorHex } : {}),
        ...(additionalArgsHex !== undefined ? { additionalArgsHex } : {}),
        remainingAccounts: parseRemainingAccounts(strategyForm.remainingAccountsJson),
        updateSubmissionDossier: true,
      });

      setStrategyState({
        loading: false,
        error: null,
        success: `Strategy initialized. Signature: ${result.signature}`,
      });
      refresh();
    } catch (error) {
      setStrategyState({
        loading: false,
        error: error instanceof Error ? error.message : 'Strategy initialization failed.',
        success: null,
      });
    }
  }

  async function handleStrategyOperation(
    action: 'deposit' | 'withdraw',
  ): Promise<void> {
    const form = action === 'deposit' ? depositForm : withdrawForm;
    const setState = action === 'deposit' ? setDepositState : setWithdrawState;
    const request = action === 'deposit' ? depositRangerStrategy : withdrawRangerStrategy;
    const verb = action === 'deposit' ? 'deposited' : 'withdrawn';

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const vaultAssetMint = normalizeOptional(form.vaultAssetMint);
      const adaptorProgramId = normalizeOptional(form.adaptorProgramId);
      const instructionDiscriminatorHex = normalizeOptional(form.instructionDiscriminatorHex);
      const additionalArgsHex = normalizeOptional(form.additionalArgsHex);
      const result = await request({
        vaultId: form.vaultId.trim(),
        strategyAddress: form.strategyAddress.trim(),
        amount: form.amount.trim(),
        ...(vaultAssetMint !== undefined ? { vaultAssetMint } : {}),
        ...(adaptorProgramId !== undefined ? { adaptorProgramId } : {}),
        ...(instructionDiscriminatorHex !== undefined ? { instructionDiscriminatorHex } : {}),
        ...(additionalArgsHex !== undefined ? { additionalArgsHex } : {}),
        remainingAccounts: parseRemainingAccounts(form.remainingAccountsJson),
        updateSubmissionDossier: true,
      });

      setState({
        loading: false,
        error: null,
        success: `Strategy funds ${verb}. Signature: ${result.signature}`,
      });
      refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : `Strategy ${action} failed.`,
        success: null,
      });
    }
  }

  return (
    <div className="signal-list">
      <div className="signal-list__item">
        <div className="signal-list__header">
          <div>
            <p className="signal-list__label">Step 1</p>
            <div className="signal-list__value">Create Ranger vault</div>
          </div>
        </div>
        <p className="signal-list__detail">
          Admin-only. Creates the Ranger vault and syncs the dossier with the resulting vault and LP mint addresses.
        </p>
        <label className="field">
          <span>Asset Mint</span>
          <input
            className="input"
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, assetMint: event.target.value }))}
            placeholder="USDC mint address"
            type="text"
            value={createVaultForm.assetMint}
          />
        </label>
        <label className="field">
          <span>Vault Name</span>
          <input
            className="input"
            maxLength={32}
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            value={createVaultForm.name}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <input
            className="input"
            maxLength={64}
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, description: event.target.value }))}
            type="text"
            value={createVaultForm.description}
          />
        </label>
        <label className="field">
          <span>Max Cap</span>
          <input
            className="input"
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, maxCap: event.target.value }))}
            placeholder="18446744073709551615 for uncapped"
            type="text"
            value={createVaultForm.maxCap}
          />
        </label>
        <label className="field">
          <span>Strategy Id</span>
          <input
            className="input"
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, strategyId: event.target.value }))}
            type="text"
            value={createVaultForm.strategyId}
          />
        </label>
        <label className="field">
          <span>Strategy Metadata Uri</span>
          <input
            className="input"
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, strategyMetadataUri: event.target.value }))}
            placeholder="https://..."
            type="text"
            value={createVaultForm.strategyMetadataUri}
          />
        </label>
        <label className="field">
          <span>LP Token Name</span>
          <input
            className="input"
            maxLength={32}
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, lpTokenName: event.target.value }))}
            type="text"
            value={createVaultForm.lpTokenName}
          />
        </label>
        <label className="field">
          <span>LP Token Symbol</span>
          <input
            className="input"
            maxLength={10}
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, lpTokenSymbol: event.target.value }))}
            type="text"
            value={createVaultForm.lpTokenSymbol}
          />
        </label>
        <label className="field">
          <span>Manager Public Key</span>
          <input
            className="input"
            onChange={(event) => setCreateVaultForm((current) => ({ ...current, managerPublicKey: event.target.value }))}
            placeholder="Optional override"
            type="text"
            value={createVaultForm.managerPublicKey}
          />
        </label>
        <label className="field">
          <span>Cluster</span>
          <select
            className="select"
            onChange={(event) =>
              setCreateVaultForm((current) => ({
                ...current,
                cluster: event.target.value as SubmissionCluster,
              }))}
            value={createVaultForm.cluster}
          >
            <option value="devnet">devnet</option>
            <option value="mainnet-beta">mainnet-beta</option>
          </select>
        </label>
        <div className="button-row">
          <button
            className="button"
            disabled={createVaultState.loading || !isAdmin}
            onClick={() => void handleCreateVault()}
            type="button"
          >
            {createVaultState.loading ? 'Creating vault...' : 'Create Ranger Vault'}
          </button>
        </div>
        {createVaultState.error !== null ? <p className="feedback feedback--error">{createVaultState.error}</p> : null}
        {createVaultState.success !== null ? <p className="feedback feedback--success">{createVaultState.success}</p> : null}
      </div>

      <div className="signal-list__item">
        <div className="signal-list__header">
          <div>
            <p className="signal-list__label">Steps 2-4</p>
            <div className="signal-list__value">Wire metadata, adaptor, and strategy</div>
          </div>
        </div>
        <p className="signal-list__detail">
          Admin-only. These actions follow the Ranger setup sequence in the repo notes: LP metadata, adaptor attachment, then strategy initialization.
        </p>

        <label className="field">
          <span>Vault Id For LP Metadata</span>
          <input
            className="input"
            onChange={(event) => setLpMetadataForm((current) => ({ ...current, vaultId: event.target.value }))}
            type="text"
            value={lpMetadataForm.vaultId}
          />
        </label>
        <label className="field">
          <span>LP Metadata Name</span>
          <input
            className="input"
            onChange={(event) => setLpMetadataForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            value={lpMetadataForm.name}
          />
        </label>
        <label className="field">
          <span>LP Metadata Symbol</span>
          <input
            className="input"
            onChange={(event) => setLpMetadataForm((current) => ({ ...current, symbol: event.target.value }))}
            type="text"
            value={lpMetadataForm.symbol}
          />
        </label>
        <label className="field">
          <span>LP Metadata Uri</span>
          <input
            className="input"
            onChange={(event) => setLpMetadataForm((current) => ({ ...current, uri: event.target.value }))}
            placeholder="https://..."
            type="text"
            value={lpMetadataForm.uri}
          />
        </label>
        <div className="button-row">
          <button
            className="button button--secondary"
            disabled={lpMetadataState.loading || !isAdmin}
            onClick={() => void handleCreateLpMetadata()}
            type="button"
          >
            {lpMetadataState.loading ? 'Submitting LP metadata...' : 'Create LP Metadata'}
          </button>
        </div>
        {lpMetadataState.error !== null ? <p className="feedback feedback--error">{lpMetadataState.error}</p> : null}
        {lpMetadataState.success !== null ? <p className="feedback feedback--success">{lpMetadataState.success}</p> : null}

        <label className="field">
          <span>Vault Id For Adaptor</span>
          <input
            className="input"
            onChange={(event) => setAdaptorForm((current) => ({ ...current, vaultId: event.target.value }))}
            type="text"
            value={adaptorForm.vaultId}
          />
        </label>
        <label className="field">
          <span>Adaptor Program Id</span>
          <input
            className="input"
            onChange={(event) => setAdaptorForm((current) => ({ ...current, adaptorProgramId: event.target.value }))}
            type="text"
            value={adaptorForm.adaptorProgramId}
          />
        </label>
        <div className="button-row">
          <button
            className="button button--secondary"
            disabled={adaptorState.loading || !isAdmin}
            onClick={() => void handleAddAdaptor()}
            type="button"
          >
            {adaptorState.loading ? 'Adding adaptor...' : 'Add Adaptor'}
          </button>
        </div>
        {adaptorState.error !== null ? <p className="feedback feedback--error">{adaptorState.error}</p> : null}
        {adaptorState.success !== null ? <p className="feedback feedback--success">{adaptorState.success}</p> : null}

        <label className="field">
          <span>Vault Id For Strategy Init</span>
          <input
            className="input"
            onChange={(event) => setStrategyForm((current) => ({ ...current, vaultId: event.target.value }))}
            type="text"
            value={strategyForm.vaultId}
          />
        </label>
        <label className="field">
          <span>Strategy Address</span>
          <input
            className="input"
            onChange={(event) => setStrategyForm((current) => ({ ...current, strategyAddress: event.target.value }))}
            type="text"
            value={strategyForm.strategyAddress}
          />
        </label>
        <label className="field">
          <span>Adaptor Program Id</span>
          <input
            className="input"
            onChange={(event) => setStrategyForm((current) => ({ ...current, adaptorProgramId: event.target.value }))}
            type="text"
            value={strategyForm.adaptorProgramId}
          />
        </label>
        <label className="field">
          <span>Instruction Discriminator Hex</span>
          <input
            className="input"
            onChange={(event) =>
              setStrategyForm((current) => ({ ...current, instructionDiscriminatorHex: event.target.value }))}
            placeholder="Optional"
            type="text"
            value={strategyForm.instructionDiscriminatorHex}
          />
        </label>
        <label className="field">
          <span>Additional Args Hex</span>
          <input
            className="input"
            onChange={(event) => setStrategyForm((current) => ({ ...current, additionalArgsHex: event.target.value }))}
            placeholder="Optional"
            type="text"
            value={strategyForm.additionalArgsHex}
          />
        </label>
        <label className="field">
          <span>Remaining Accounts Json</span>
          <textarea
            className="textarea"
            onChange={(event) => setStrategyForm((current) => ({ ...current, remainingAccountsJson: event.target.value }))}
            rows={4}
            value={strategyForm.remainingAccountsJson}
          />
        </label>
        <div className="button-row">
          <button
            className="button button--secondary"
            disabled={strategyState.loading || !isAdmin}
            onClick={() => void handleInitializeStrategy()}
            type="button"
          >
            {strategyState.loading ? 'Initializing strategy...' : 'Initialize Strategy'}
          </button>
        </div>
        {strategyState.error !== null ? <p className="feedback feedback--error">{strategyState.error}</p> : null}
        {strategyState.success !== null ? <p className="feedback feedback--success">{strategyState.success}</p> : null}
      </div>

      <div className="signal-list__item">
        <div className="signal-list__header">
          <div>
            <p className="signal-list__label">Steps 5+</p>
            <div className="signal-list__value">Allocate or withdraw strategy capital</div>
          </div>
        </div>
        <p className="signal-list__detail">
          Operator or admin. This maps allocator intent onto Ranger manager transactions after strategy setup is complete.
        </p>

        <label className="field">
          <span>Deposit Vault Id</span>
          <input
            className="input"
            onChange={(event) => setDepositForm((current) => ({ ...current, vaultId: event.target.value }))}
            type="text"
            value={depositForm.vaultId}
          />
        </label>
        <label className="field">
          <span>Deposit Strategy Address</span>
          <input
            className="input"
            onChange={(event) => setDepositForm((current) => ({ ...current, strategyAddress: event.target.value }))}
            type="text"
            value={depositForm.strategyAddress}
          />
        </label>
        <label className="field">
          <span>Deposit Amount</span>
          <input
            className="input"
            onChange={(event) => setDepositForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Raw token amount"
            type="text"
            value={depositForm.amount}
          />
        </label>
        <label className="field">
          <span>Deposit Vault Asset Mint</span>
          <input
            className="input"
            onChange={(event) => setDepositForm((current) => ({ ...current, vaultAssetMint: event.target.value }))}
            placeholder="Optional"
            type="text"
            value={depositForm.vaultAssetMint}
          />
        </label>
        <label className="field">
          <span>Deposit Adaptor Program Id</span>
          <input
            className="input"
            onChange={(event) => setDepositForm((current) => ({ ...current, adaptorProgramId: event.target.value }))}
            type="text"
            value={depositForm.adaptorProgramId}
          />
        </label>
        <label className="field">
          <span>Deposit Remaining Accounts Json</span>
          <textarea
            className="textarea"
            onChange={(event) => setDepositForm((current) => ({ ...current, remainingAccountsJson: event.target.value }))}
            rows={4}
            value={depositForm.remainingAccountsJson}
          />
        </label>
        <div className="button-row">
          <button
            className="button"
            disabled={depositState.loading || !canOperate}
            onClick={() => void handleStrategyOperation('deposit')}
            type="button"
          >
            {depositState.loading ? 'Depositing...' : 'Deposit To Strategy'}
          </button>
        </div>
        {depositState.error !== null ? <p className="feedback feedback--error">{depositState.error}</p> : null}
        {depositState.success !== null ? <p className="feedback feedback--success">{depositState.success}</p> : null}

        <label className="field">
          <span>Withdraw Vault Id</span>
          <input
            className="input"
            onChange={(event) => setWithdrawForm((current) => ({ ...current, vaultId: event.target.value }))}
            type="text"
            value={withdrawForm.vaultId}
          />
        </label>
        <label className="field">
          <span>Withdraw Strategy Address</span>
          <input
            className="input"
            onChange={(event) => setWithdrawForm((current) => ({ ...current, strategyAddress: event.target.value }))}
            type="text"
            value={withdrawForm.strategyAddress}
          />
        </label>
        <label className="field">
          <span>Withdraw Amount</span>
          <input
            className="input"
            onChange={(event) => setWithdrawForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Raw token amount"
            type="text"
            value={withdrawForm.amount}
          />
        </label>
        <label className="field">
          <span>Withdraw Vault Asset Mint</span>
          <input
            className="input"
            onChange={(event) => setWithdrawForm((current) => ({ ...current, vaultAssetMint: event.target.value }))}
            placeholder="Optional"
            type="text"
            value={withdrawForm.vaultAssetMint}
          />
        </label>
        <label className="field">
          <span>Withdraw Adaptor Program Id</span>
          <input
            className="input"
            onChange={(event) => setWithdrawForm((current) => ({ ...current, adaptorProgramId: event.target.value }))}
            type="text"
            value={withdrawForm.adaptorProgramId}
          />
        </label>
        <label className="field">
          <span>Withdraw Remaining Accounts Json</span>
          <textarea
            className="textarea"
            onChange={(event) => setWithdrawForm((current) => ({ ...current, remainingAccountsJson: event.target.value }))}
            rows={4}
            value={withdrawForm.remainingAccountsJson}
          />
        </label>
        <div className="button-row">
          <button
            className="button button--secondary"
            disabled={withdrawState.loading || !canOperate}
            onClick={() => void handleStrategyOperation('withdraw')}
            type="button"
          >
            {withdrawState.loading ? 'Withdrawing...' : 'Withdraw From Strategy'}
          </button>
        </div>
        {withdrawState.error !== null ? <p className="feedback feedback--error">{withdrawState.error}</p> : null}
        {withdrawState.success !== null ? <p className="feedback feedback--success">{withdrawState.success}</p> : null}

        {!isAdmin ? (
          <p className="feedback feedback--warning">
            Admin role is required for vault creation, LP metadata, adaptor, and strategy initialization.
          </p>
        ) : null}
        {!canOperate ? (
          <p className="feedback feedback--warning">
            Your role is read-only for Ranger allocation actions.
          </p>
        ) : null}
      </div>
    </div>
  );
}
