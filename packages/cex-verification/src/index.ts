// =============================================================================
// @sentinel-apex/cex-verification — CEX trade import and verification
// =============================================================================

// CSV Parser
export type {
  CexPlatform,
  ParsedTrade,
  ParseResult,
  ParseError,
  ParseStats,
  CsvParserOptions,
} from './csv-parser.js';
export {
  parseCexCsv,
  detectPlatform,
  validateCsvFormat,
} from './csv-parser.js';

// PnL Calculator
export type {
  PnlCalculationMethod,
  TradeWithPnl,
  AssetPnlResult,
  AssetPnlSummary,
  PortfolioPnlResult,
  PortfolioPnlSummary,
  HackathonSubmissionPnl,
} from './pnl-calculator.js';
export {
  calculateAssetPnl,
  calculatePortfolioPnl,
  groupTradesByAsset,
  calculateAnnualizedReturn,
  generateHackathonSubmission,
} from './pnl-calculator.js';

// Import Validator (placeholder for future implementation)
// export type {
//   PnlValidationResult,
//   PnlDiscrepancy,
//   PnlValidationOptions,
// } from './import-validator.js';
// export {
//   validateImportedPnl,
// } from './import-validator.js';
