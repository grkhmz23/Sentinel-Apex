'use client';

import { useCallback, useState } from 'react';

import { ErrorState } from '../../src/components/error-state';
import { useOperator } from '../../src/components/operator-context';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import {
  calculateCexPnl,
  createCexVerificationSession,
  generateCexSubmissionReport,
  validateCexCsv,
} from '../../src/lib/runtime-api.client';

import type { DashboardSession } from '../../src/lib/operator-session';

const PLATFORMS = [
  { value: 'binance', label: 'Binance' },
  { value: 'okx', label: 'OKX' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'coinbase', label: 'Coinbase' },
] as const;

const PNL_METHODS = [
  { value: 'fifo', label: 'FIFO' },
  { value: 'lifo', label: 'LIFO' },
  { value: 'avg', label: 'Average Cost' },
] as const;

interface CexImportFormProps {
  _session: DashboardSession;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'validation_error'; message: string }
  | { status: 'ready_to_upload'; csvContent: string; detectedPlatform: string | undefined }
  | { status: 'uploading' }
  | { status: 'uploaded'; sessionId: string; platform: string; totalTrades: number }
  | { status: 'calculating_pnl' }
  | { status: 'pnl_calculated'; result: Awaited<ReturnType<typeof calculateCexPnl>> }
  | { status: 'generating_report' }
  | { status: 'report_generated'; report: Awaited<ReturnType<typeof generateCexSubmissionReport>> }
  | { status: 'error'; message: string };

export function CexImportForm({ _session }: CexImportFormProps): JSX.Element {
  const { canOperate } = useOperator();
  const [csvText, setCsvText] = useState('');
  const [platform, setPlatform] = useState('');
  const [method, setMethod] = useState<'fifo' | 'lifo' | 'avg'>('fifo');
  const [includeFees, setIncludeFees] = useState(true);
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  const handleValidate = useCallback(async () => {
    if (!csvText.trim()) {
      setState({ status: 'validation_error', message: 'Please paste CSV content' });
      return;
    }
    setState({ status: 'validating' });
    try {
      const result = await validateCexCsv(
        csvText,
        platform ? (platform as 'binance' | 'okx' | 'bybit' | 'coinbase') : undefined,
      );
      if (!result.valid) {
        setState({
          status: 'validation_error',
          message: `Invalid CSV: ${result.errors.map((e) => `Row ${e.row}: ${e.message}`).join(', ')}`,
        });
        return;
      }
      setState({
        status: 'ready_to_upload',
        csvContent: csvText,
        detectedPlatform: result.detectedPlatform,
      });
    } catch (error) {
      setState({
        status: 'validation_error',
        message: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  }, [csvText, platform]);

  const handleUpload = useCallback(async () => {
    if (state.status !== 'ready_to_upload') return;
    setState({ status: 'uploading' });
    try {
      const result = await createCexVerificationSession({
        sleeveId: 'carry',
        platform: (platform || state.detectedPlatform || 'binance') as 'binance' | 'okx' | 'bybit' | 'coinbase',
        csvContent: state.csvContent,
        fileName: 'manual-upload.csv',
      });
      setState({
        status: 'uploaded',
        sessionId: result.id,
        platform: result.platform,
        totalTrades: result.totalTrades,
      });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }, [state, platform]);

  const handleCalculatePnl = useCallback(async () => {
    if (state.status !== 'uploaded') return;
    setState({ status: 'calculating_pnl' });
    try {
      const result = await calculateCexPnl(state.sessionId, { method, includeFees });
      setState({ status: 'pnl_calculated', result });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'PnL calculation failed',
      });
    }
  }, [state, method, includeFees]);

  const handleGenerateReport = useCallback(async () => {
    if (state.status !== 'uploaded' && state.status !== 'pnl_calculated') return;
    const sessionId = state.status === 'uploaded' ? state.sessionId : '';
    if (!sessionId) return;
    setState({ status: 'generating_report' });
    try {
      const report = await generateCexSubmissionReport(sessionId, { method, includeFees });
      setState({ status: 'report_generated', report });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Report generation failed',
      });
    }
  }, [state, method, includeFees]);

  const canValidate = csvText.trim().length > 0 && state.status !== 'validating';
  const canUpload = state.status === 'ready_to_upload' && canOperate;
  const canCalculatePnl = state.status === 'uploaded' && canOperate;
  const canGenerateReport = (state.status === 'uploaded' || state.status === 'pnl_calculated') && canOperate;

  return (
    <>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Verification</p>
            <h1>CEX Trade Import</h1>
          </div>
        </header>

        <div className="grid grid--two-column">
          <Panel subtitle="Upload trade history CSV" title="Import Trades">
            <div className="stack">
              <div>
                <label className="form-label" htmlFor="platform">Platform (optional)</label>
                <select className="form-select" id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Auto-detect</option>
                  {PLATFORMS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="csv">CSV Content</label>
                <textarea className="form-textarea" id="csv" rows={10} placeholder="Paste CSV here..." value={csvText} onChange={(e) => setCsvText(e.target.value)} disabled={state.status === 'validating' || state.status === 'uploading'} />
                <p className="panel__hint">Paste trade history CSV from exchange export.</p>
              </div>
              {state.status === 'validation_error' && <ErrorState message={state.message} title="Validation Error" />}
              {state.status === 'ready_to_upload' && (
                <p className="feedback feedback--success">CSV valid! Detected: {state.detectedPlatform || 'unknown'}</p>
              )}
              {state.status === 'uploaded' && (
                <p className="feedback feedback--success">Uploaded {state.totalTrades} trades. Session: {state.sessionId}</p>
              )}
              <div className="button-row">
                <button className="button" onClick={() => void handleValidate()} disabled={!canValidate}>
                  {state.status === 'validating' ? 'Validating...' : 'Validate CSV'}
                </button>
                <button className="button" onClick={() => void handleUpload()} disabled={!canUpload}>
                  {state.status === 'uploading' ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              {!canOperate && <p className="feedback feedback--warning">Read-only role. Upload requires operator.</p>}
            </div>
          </Panel>

          <Panel subtitle="PnL Calculation Options" title="Calculate PnL">
            <div className="stack">
              <div>
                <label className="form-label" htmlFor="method">Cost Basis Method</label>
                <select className="form-select" id="method" value={method} onChange={(e) => setMethod(e.target.value as 'fifo' | 'lifo' | 'avg')}>
                  {PNL_METHODS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                </select>
              </div>
              <div>
                <label className="form-label">
                  <input type="checkbox" checked={includeFees} onChange={(e) => setIncludeFees(e.target.checked)} /> Include fees in PnL
                </label>
              </div>
              <div className="button-row">
                <button className="button" onClick={() => void handleCalculatePnl()} disabled={!canCalculatePnl}>
                  {state.status === 'calculating_pnl' ? 'Calculating...' : 'Calculate PnL'}
                </button>
                <button className="button button--secondary" onClick={() => void handleGenerateReport()} disabled={!canGenerateReport}>
                  {state.status === 'generating_report' ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>
          </Panel>
        </div>

        {state.status === 'pnl_calculated' && (
          <Panel subtitle="Portfolio PnL Summary" title="PnL Results">
            <div className="grid grid--metrics">
              <Panel title="Overview">
                <p><strong>Total Trades:</strong> {state.result.summary.totalTrades}</p>
                <p><strong>Net PnL:</strong> {state.result.summary.netPnl}</p>
                <p><strong>Total Fees:</strong> {state.result.summary.totalFees}</p>
                <p><strong>Win Rate:</strong> {state.result.summary.winRate}</p>
                <p><strong>Profitable Trades:</strong> {state.result.summary.profitableTrades}</p>
                <p><strong>Losing Trades:</strong> {state.result.summary.losingTrades}</p>
              </Panel>
              <Panel title="Statistics">
                <p><strong>Largest Win:</strong> {state.result.summary.largestWin}</p>
                <p><strong>Largest Loss:</strong> {state.result.summary.largestLoss}</p>
                <p><strong>Average Win:</strong> {state.result.summary.averageWin}</p>
                <p><strong>Average Loss:</strong> {state.result.summary.averageLoss}</p>
                <p><strong>Profit Factor:</strong> {state.result.summary.profitFactor}</p>
                <p><strong>Trading Days:</strong> {state.result.summary.tradingDays}</p>
              </Panel>
            </div>
            <h3>By Asset</h3>
            <table className="table">
              <thead>
                <tr><th>Asset</th><th>Trades</th><th>Realized PnL</th><th>Win Rate</th></tr>
              </thead>
              <tbody>
                {state.result.assets.map((a) => (
                  <tr key={a.asset}>
                    <td>{a.asset}</td>
                    <td>{a.summary.totalTrades}</td>
                    <td>{a.summary.realizedPnl}</td>
                    <td>{a.summary.winRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {state.status === 'report_generated' && (
          <Panel subtitle="Hackathon Submission Report" title="Submission Report">
            <div className="grid grid--metrics">
              <Panel title="Portfolio Summary">
                <p><strong>Total Trades:</strong> {state.report.portfolioSummary.totalTrades}</p>
                <p><strong>Total PnL:</strong> {state.report.portfolioSummary.totalPnl}</p>
                <p><strong>Total Fees:</strong> {state.report.portfolioSummary.totalFees}</p>
                <p><strong>Win Rate:</strong> {state.report.portfolioSummary.winRate}</p>
              </Panel>
              <Panel title="Eligibility">
                <p><StatusBadge label={state.report.hackathonEligibility.hasSufficientTrades ? 'PASS' : 'FAIL'} tone={state.report.hackathonEligibility.hasSufficientTrades ? 'good' : 'bad'} /> Sufficient Trades</p>
                <p><StatusBadge label={state.report.hackathonEligibility.hasPositivePnl ? 'PASS' : 'FAIL'} tone={state.report.hackathonEligibility.hasPositivePnl ? 'good' : 'bad'} /> Positive PnL</p>
                <p><StatusBadge label={state.report.hackathonEligibility.meetsMinimumPeriod ? 'PASS' : 'FAIL'} tone={state.report.hackathonEligibility.meetsMinimumPeriod ? 'good' : 'bad'} /> Minimum Period</p>
              </Panel>
            </div>
          </Panel>
        )}

        {state.status === 'error' && <ErrorState message={state.message} title="Error" />}
      </div>
    </>
  );
}
