// =============================================================================
// Sentinel Apex — Backtest Report Generator
// =============================================================================

import type { BacktestResults, BacktestReport, BacktestExportFormat } from './types.js';
import { formatDate, formatNumber, formatPercent, formatDuration } from './utils.js';

/**
 * Generate a backtest report in the specified format
 */
export function generateReport(
  results: BacktestResults,
  format: BacktestExportFormat
): BacktestReport {
  const timestamp = new Date();
  
  switch (format) {
    case 'json':
      return generateJsonReport(results, timestamp);
    case 'markdown':
      return generateMarkdownReport(results, timestamp);
    case 'csv':
      return generateCsvReport(results, timestamp);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Generate JSON format report
 */
function generateJsonReport(results: BacktestResults, timestamp: Date): BacktestReport {
  return {
    backtestId: results.backtestId,
    runId: '', // Will be set by caller
    format: 'json',
    content: JSON.stringify(results, null, 2),
    filename: `backtest-${results.backtestId}-${formatDate(timestamp)}.json`,
    generatedAt: timestamp,
  };
}

/**
 * Generate Markdown format report (human readable)
 */
function generateMarkdownReport(results: BacktestResults, timestamp: Date): BacktestReport {
  const config = results.config;
  
  const lines: string[] = [
    '# Sentinel Apex Backtest Report',
    '',
    `**Backtest ID:** ${results.backtestId}  `,
    `**Name:** ${config.name}  `,
    `**Generated:** ${timestamp.toISOString()}  `,
    `**Simulation Duration:** ${formatDuration(results.durationMs)}`,
    '',
    '---',
    '',
    '## Configuration',
    '',
    '| Parameter | Value |',
    '|-----------|-------|',
    `| Strategy Type | ${config.strategy.type} |`,
    `| Assets | ${config.assets.join(', ')} |`,
    `| Period | ${formatDate(config.period.startDate)} to ${formatDate(config.period.endDate)} |`,
    `| Initial Capital | $${formatNumber(config.initialCapitalUsd)} |`,
    `| Target Leverage | ${config.strategy.targetLeverage}x |`,
    `| Max Position | $${formatNumber(config.strategy.maxPositionSizeUsd)} |`,
    `| Entry Basis | ≥${config.strategy.entryBasisThresholdPct}% |`,
    `| Exit Basis | ≤${config.strategy.exitBasisThresholdPct}% |`,
    `| Execution Mode | ${config.simulation.executionMode} |`,
    `| Slippage Model | ${config.simulation.slippageModel} |`,
    `| Fee Model | ${config.simulation.feeModel} |`,
    '',
    '---',
    '',
    '## Performance Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Return | ${formatPercent(results.performance.totalReturnPct)} |`,
    `| Total Return ($) | $${formatNumber(results.performance.totalReturnUsd)} |`,
    `| Annualized Return | ${formatPercent(results.performance.annualizedReturnPct)} |`,
    `| Max Drawdown | ${formatPercent(results.performance.maxDrawdownPct)} |`,
    '',
    '---',
    '',
    '## Trade Statistics',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Trades | ${results.trades.totalTrades} |`,
    `| Winning Trades | ${results.trades.winningTrades} |`,
    `| Losing Trades | ${results.trades.losingTrades} |`,
    `| Win Rate | ${formatPercent(results.trades.winRatePct)} |`,
    `| Avg Win | $${formatNumber(results.trades.avgWinUsd)} |`,
    `| Avg Loss | $${formatNumber(results.trades.avgLossUsd)} |`,
    `| Profit Factor | ${results.trades.profitFactor} |`,
    `| Largest Win | $${formatNumber(results.trades.largestWinUsd)} |`,
    `| Largest Loss | $${formatNumber(results.trades.largestLossUsd)} |`,
    '',
    '---',
    '',
    '## Funding Capture',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Funding Received | $${formatNumber(results.funding.totalFundingReceived)} |`,
    `| Total Funding Paid | $${formatNumber(results.funding.totalFundingPaid)} |`,
    `| Net Funding | $${formatNumber(results.funding.netFunding)} |`,
    `| Avg Daily Funding | $${formatNumber(results.funding.avgDailyFundingRate)} |`,
    '',
    '---',
    '',
    '## Fees',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Fees | $${formatNumber(results.fees.totalFees)} |`,
    '',
    '---',
    '',
    '## Position Statistics',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Positions | ${results.positions.totalPositions} |`,
    `| Avg Position Size | $${formatNumber(results.positions.avgPositionSizeUsd)} |`,
    `| Avg Holding Time | ${formatNumber(results.positions.avgHoldingTimeHours, 0)} hours |`,
    '',
    '---',
    '',
    '## Important Caveats',
    '',
    ...results.caveats.map((caveat) => `- ${caveat}`),
    '',
    '---',
    '',
    '## Data Provenance',
    '',
    `- **Data Source:** ${results.config.simulation.useHistoricalFunding ? 'Historical (where available)' : 'Synthetic'}  `,
    `- **Simulation Type:** ${results.config.simulation.executionMode}  `,
    `- **Results Generated:** ${results.generatedAt.toISOString()}`,
    '',
    '> ⚠️ **IMPORTANT:** These results represent historical simulation only. Past performance does not guarantee future results.',
    '> Actual trading results may differ significantly due to market conditions, execution quality, and other factors.',
    '',
  ];
  
  return {
    backtestId: results.backtestId,
    runId: '',
    format: 'markdown',
    content: lines.join('\n'),
    filename: `backtest-${results.backtestId}-${formatDate(timestamp)}.md`,
    generatedAt: timestamp,
  };
}

/**
 * Generate CSV format report (daily snapshots)
 */
function generateCsvReport(results: BacktestResults, timestamp: Date): BacktestReport {
  const headers = [
    'date',
    'portfolio_value',
    'cash_balance',
    'unrealized_pnl',
    'realized_pnl',
    'funding_paid',
    'total_fees',
    'num_positions',
  ].join(',');
  
  const rows = results.dailySnapshots.map((snapshot) => [
    formatDate(snapshot.date),
    snapshot.portfolioValue,
    snapshot.cashBalance,
    snapshot.unrealizedPnl,
    snapshot.realizedPnl,
    snapshot.fundingPaid,
    snapshot.totalFees,
    snapshot.positions.length,
  ].join(','));
  
  const content = [headers, ...rows].join('\n');
  
  return {
    backtestId: results.backtestId,
    runId: '',
    format: 'csv',
    content,
    filename: `backtest-${results.backtestId}-${formatDate(timestamp)}.csv`,
    generatedAt: timestamp,
  };
}

/**
 * Generate a summary for inclusion in submission dossier
 */
export function generateDossierSummary(results: BacktestResults): {
  label: string;
  value: string;
  category: 'performance' | 'risk' | 'activity';
}[] {
  return [
    { label: 'Backtest Period', value: `${formatDate(results.actualPeriod.startDate)} to ${formatDate(results.actualPeriod.endDate)}`, category: 'activity' },
    { label: 'Total Return', value: formatPercent(results.performance.totalReturnPct), category: 'performance' },
    { label: 'Annualized Return', value: formatPercent(results.performance.annualizedReturnPct), category: 'performance' },
    { label: 'Max Drawdown', value: formatPercent(results.performance.maxDrawdownPct), category: 'risk' },
    { label: 'Total Trades', value: String(results.trades.totalTrades), category: 'activity' },
    { label: 'Win Rate', value: formatPercent(results.trades.winRatePct), category: 'performance' },
    { label: 'Net Funding', value: `$${formatNumber(results.funding.netFunding)}`, category: 'performance' },
    { label: 'Total Fees', value: `$${formatNumber(results.fees.totalFees)}`, category: 'activity' },
  ];
}
