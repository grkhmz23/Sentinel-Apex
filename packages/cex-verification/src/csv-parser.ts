// =============================================================================
// CEX Trade History CSV Parser
// Supports: Binance, OKX, Bybit formats
// =============================================================================

// Using native numbers for calculations

export type CexPlatform = 'binance' | 'okx' | 'bybit' | 'coinbase';

export interface ParsedTrade {
  tradeId: string;
  orderId: string | undefined;
  symbol: string;
  asset: string;
  quoteAsset: string | undefined;
  side: 'buy' | 'sell';
  type: string | undefined;
  quantity: string;
  price: string;
  quoteQuantity: string | undefined;
  fee: string | undefined;
  feeAsset: string | undefined;
  realizedPnl: string | undefined;
  tradeTime: Date;
  raw: Record<string, string>; // Original CSV row
}

export interface ParseResult {
  trades: ParsedTrade[];
  errors: ParseError[];
  stats: ParseStats;
}

export interface ParseError {
  row: number;
  raw: Record<string, string>;
  message: string;
}

export interface ParseStats {
  totalRows: number;
  parsedTrades: number;
  skippedRows: number;
  errors: number;
  dateRange: { from: Date; to: Date } | undefined;
}

export interface CsvParserOptions {
  platform: CexPlatform;
  skipInvalidRows?: boolean;
  validateSymbol?: (symbol: string) => boolean;
  minTradeTime?: Date;
  maxTradeTime?: Date;
}

// Parse CSV content based on platform
export function parseCexCsv(
  csvContent: string,
  options: CsvParserOptions,
): ParseResult {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return {
      trades: [],
      errors: [{ row: 0, raw: {}, message: 'CSV has no data rows' }],
      stats: { totalRows: 0, parsedTrades: 0, skippedRows: 0, errors: 1, dateRange: undefined },
    };
  }

  // Parse header
  const firstLine = lines[0];
  if (!firstLine) {
    return {
      trades: [],
      errors: [{ row: 0, raw: {}, message: 'CSV has no header row' }],
      stats: { totalRows: 0, parsedTrades: 0, skippedRows: 0, errors: 1, dateRange: undefined },
    };
  }
  const headers = parseCsvLine(firstLine);
  
  const trades: ParsedTrade[] = [];
  const errors: ParseError[] = [];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') {
      skippedRows++;
      continue;
    }

    const raw = parseCsvLine(line);
    const rowData = arrayToObject(headers, raw);

    try {
      const trade = parseTradeRow(rowData, options.platform);
      
      // Validate symbol if filter provided
      if (options.validateSymbol && !options.validateSymbol(trade.symbol)) {
        skippedRows++;
        continue;
      }

      // Validate time range
      if (options.minTradeTime && trade.tradeTime < options.minTradeTime) {
        skippedRows++;
        continue;
      }
      if (options.maxTradeTime && trade.tradeTime > options.maxTradeTime) {
        skippedRows++;
        continue;
      }

      trades.push(trade);
    } catch (error) {
      errors.push({
        row: i + 1,
        raw: rowData,
        message: error instanceof Error ? error.message : String(error),
      });
      if (!options.skipInvalidRows) {
        break;
      }
    }
  }

  // Calculate date range
  const dates = trades.map(t => t.tradeTime).sort((a, b) => a.getTime() - b.getTime());

  return {
    trades,
    errors,
    stats: {
      totalRows: lines.length - 1,
      parsedTrades: trades.length,
      skippedRows,
      errors: errors.length,
      dateRange: ((): { from: Date; to: Date } | undefined => {
        const from = dates[0];
        const to = dates[dates.length - 1];
        return from && to ? { from, to } : undefined;
      })(),
    },
  };
}

// Parse a single CSV line respecting quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function arrayToObject(headers: string[], values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((header, i) => {
    result[header.trim()] = values[i] ?? '';
  });
  return result;
}

function parseTradeRow(row: Record<string, string>, platform: CexPlatform): ParsedTrade {
  switch (platform) {
    case 'binance':
      return parseBinanceRow(row);
    case 'okx':
      return parseOkxRow(row);
    case 'bybit':
      return parseBybitRow(row);
    case 'coinbase':
      return parseCoinbaseRow(row);
    default:
      throw new Error(`Unsupported platform: ${String(platform)}`);
  }
}

// Binance spot/futures trade history format
function parseBinanceRow(row: Record<string, string>): ParsedTrade {
  // Binance headers vary between spot and futures, try multiple variants
  const tradeId = row['Trade ID'] || row['tradeId'] || row['OrderNo'] || row['OrderId'] || '';
  const orderId = row['Order ID'] || row['orderId'] || '';
  const symbol = row['Symbol'] || row['symbol'] || row['Pair'] || '';
  const side = (row['Side'] || row['side'] || '').toLowerCase();
  const price = row['Price'] || row['price'] || row['Average Price'] || '';
  const quantity = row['Quantity'] || row['Executed'] || row['Amount'] || row['quantity'] || '';
  const quoteQty = row['QuoteQuantity'] || row['Quote Quantity'] || row['Amount'] || undefined;
  const fee = row['Fee'] || row['fee'] || row['Trading Fee'] || row['Commission'] || row['commission'] || undefined;
  const feeAsset = row['FeeAsset'] || row['Fee Asset'] || row['Commission Asset'] || undefined;
  const realizedPnl = row['Realized Profit'] || row['realizedPnl'] || undefined;
  const timeStr = row['Time(UTC)'] || row['Time'] || row['Date(UTC)'] || row['date'] || row['Date'] || '';

  if (!tradeId || !symbol || !side || !price || !quantity) {
    throw new Error(`Missing required fields: tradeId=${tradeId}, symbol=${symbol}, side=${side}`);
  }

  if (side !== 'buy' && side !== 'sell') {
    throw new Error(`Invalid side: ${side}`);
  }

  const tradeTime = parseDate(timeStr);
  const { asset, quoteAsset } = extractAssetsFromSymbol(symbol);

  return {
    tradeId,
    orderId,
    symbol,
    asset,
    quoteAsset,
    side,
    type: row['Type'] || row['type'],
    quantity: normalizeNumber(quantity),
    price: normalizeNumber(price),
    quoteQuantity: quoteQty ? normalizeNumber(quoteQty) : undefined,
    fee: fee ? normalizeNumber(fee) : undefined,
    feeAsset: feeAsset || undefined,
    realizedPnl: realizedPnl ? normalizeNumber(realizedPnl) : undefined,
    tradeTime,
    raw: row,
  };
}

// OKX trade history format
function parseOkxRow(row: Record<string, string>): ParsedTrade {
  const tradeId = row['tradeId'] || row['Trade ID'] || row['ordId'] || '';
  const orderId = row['orderId'] || row['Order ID'] || '';
  const symbol = row['instId'] || row['Instrument'] || row['symbol'] || '';
  const side = (row['side'] || row['Side'] || '').toLowerCase();
  const price = row['fillPx'] || row['Price'] || row['price'] || '';
  const quantity = row['fillSz'] || row['Size'] || row['quantity'] || '';
  const fee = row['fee'] || row['Fee'] || '';
  const feeAsset = row['feeCcy'] || row['Fee Currency'] || '';
  const pnl = row['pnl'] || row['Realized PnL'] || '';
  const timeStr = row['fillTime'] || row['Timestamp'] || row['time'] || '';

  if (!tradeId || !symbol || !side || !price || !quantity) {
    throw new Error(`Missing required fields`);
  }

  if (side !== 'buy' && side !== 'sell') {
    throw new Error(`Invalid side: ${side}`);
  }

  const tradeTime = parseOkxDate(timeStr);
  const { asset, quoteAsset } = extractAssetsFromOkxSymbol(symbol);

  return {
    tradeId,
    orderId,
    symbol,
    asset,
    quoteAsset,
    side,
    type: row['ordType'] || row['Type'],
    quantity: normalizeNumber(quantity),
    price: normalizeNumber(price),
    quoteQuantity: calculateQuoteQuantity(quantity, price),
    fee: fee ? normalizeNumber(fee) : undefined,
    feeAsset: feeAsset || undefined,
    realizedPnl: pnl ? normalizeNumber(pnl) : undefined,
    tradeTime,
    raw: row,
  };
}

// Bybit trade history format
function parseBybitRow(row: Record<string, string>): ParsedTrade {
  const tradeId = row['Trade ID'] || row['tradeId'] || row['execId'] || '';
  const orderId = row['Order ID'] || row['orderId'] || '';
  const symbol = row['Symbol'] || row['symbol'] || '';
  const side = (row['Side'] || row['side'] || '').toLowerCase();
  const price = row['Price'] || row['execPrice'] || row['price'] || '';
  const quantity = row['Qty'] || row['Size'] || row['execQty'] || '';
  const fee = row['Trading Fee'] || row['fee'] || row['execFee'] || undefined;
  const feeAsset = row['Fee Token'] || row['feeCurrency'] || undefined;
  const pnl = row['Realized P&L'] || row['closedPnl'] || undefined;
  const timeStr = row['Transaction Time'] || row['Time'] || row['execTime'] || '';

  if (!tradeId || !symbol || !side || !price || !quantity) {
    throw new Error(`Missing required fields`);
  }

  if (side !== 'buy' && side !== 'sell') {
    throw new Error(`Invalid side: ${side}`);
  }

  const tradeTime = parseDate(timeStr);
  const { asset, quoteAsset } = extractAssetsFromSymbol(symbol);

  return {
    tradeId,
    orderId,
    symbol,
    asset,
    quoteAsset,
    side,
    type: row['Type'] || row['orderType'],
    quantity: normalizeNumber(quantity),
    price: normalizeNumber(price),
    quoteQuantity: calculateQuoteQuantity(quantity, price),
    fee: fee ? normalizeNumber(fee) : undefined,
    feeAsset: feeAsset || undefined,
    realizedPnl: pnl ? normalizeNumber(pnl) : undefined,
    tradeTime,
    raw: row,
  };
}

// Coinbase/Advanced Trade format
function parseCoinbaseRow(row: Record<string, string>): ParsedTrade {
  const tradeId = row['trade id'] || row['trade_id'] || '';
  const product = row['product'] || row['product_id'] || '';
  const side = (row['side'] || '').toLowerCase();
  const price = row['price'] || '';
  const quantity = row['size'] || row['amount'] || '';
  const fee = row['fee'] || '';
  const timeStr = row['time'] || row['created at'] || '';

  if (!tradeId || !product || !side || !price || !quantity) {
    throw new Error(`Missing required fields`);
  }

  const tradeTime = parseDate(timeStr);
  const symbol = product.replace('-', ''); // BTC-USD -> BTCUSD
  const { asset, quoteAsset } = extractAssetsFromSymbol(symbol);

  return {
    tradeId,
    orderId: undefined,
    symbol,
    asset,
    quoteAsset,
    side: side as 'buy' | 'sell',
    type: row['type'] || undefined,
    quantity: normalizeNumber(quantity),
    price: normalizeNumber(price),
    quoteQuantity: calculateQuoteQuantity(quantity, price),
    fee: fee ? normalizeNumber(fee) : undefined,
    feeAsset: quoteAsset,
    realizedPnl: undefined,
    tradeTime,
    raw: row,
  };
}

// Date parsing helpers
function parseDate(dateStr: string): Date {
  // Try various formats
  const formats = [
    // ISO 8601
    (s: string) => new Date(s),
    // Binance: 2024-01-15 08:30:45
    (s: string) => {
      const match = s.match(/^(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}:\d{2})/);
      if (match) return new Date(`${match[1]}T${match[2]}Z`);
      return null;
    },
    // Unix timestamp (ms)
    (s: string) => {
      const ts = Number(s);
      if (!Number.isNaN(ts) && ts > 1000000000000) {
        return new Date(ts);
      }
      return null;
    },
    // Unix timestamp (seconds)
    (s: string) => {
      const ts = Number(s);
      if (!Number.isNaN(ts) && ts > 1000000000 && ts < 10000000000) {
        return new Date(ts * 1000);
      }
      return null;
    },
  ];

  for (const fmt of formats) {
    try {
      const result = fmt(dateStr);
      if (result && !Number.isNaN(result.getTime())) {
        return result;
      }
    } catch {
      // Continue to next format
    }
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

function parseOkxDate(dateStr: string): Date {
  // OKX often uses ISO 8601 or Unix timestamp
  return parseDate(dateStr);
}

// Symbol parsing
function extractAssetsFromSymbol(symbol: string): { asset: string; quoteAsset: string } {
  // Common patterns: BTCUSDT, BTC-USDT, BTC_USDT, BTC-USD-250628
  const clean = symbol.replace(/[_-](PERP|2506\d{2}|2509\d{2}|PERPETUAL)$/i, '');
  
  // Try to identify quote asset from common patterns
  const quoteAssets = ['USDT', 'USDC', 'USD', 'BUSD', 'BTC', 'ETH'];
  
  for (const quote of quoteAssets) {
    if (clean.endsWith(quote)) {
      const asset = clean.slice(0, -quote.length);
      if (asset.length > 0) {
        return { asset, quoteAsset: quote };
      }
    }
  }

  // Default: first 3 chars as asset (e.g., BTCUSDT -> BTC, USDT)
  if (clean.length >= 6) {
    return { asset: clean.slice(0, 3), quoteAsset: clean.slice(3) };
  }

  return { asset: clean, quoteAsset: 'UNKNOWN' };
}

function extractAssetsFromOkxSymbol(symbol: string): { asset: string; quoteAsset: string } {
  // OKX format: BTC-USDT, BTC-USDT-SWAP, BTC-USDT-250628
  const parts = symbol.split('-');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { asset: parts[0], quoteAsset: parts[1] };
  }
  return extractAssetsFromSymbol(symbol);
}

// Number normalization
function normalizeNumber(value: string): string {
  // Remove commas, currency symbols, etc.
  const clean = value.replace(/[,\s$€£]/g, '');
  const num = Number(clean);
  if (Number.isNaN(num)) return '0';
  return num.toFixed(8).replace(/\.?0+$/, '');
}

function calculateQuoteQuantity(quantity: string, price: string): string {
  try {
    const qty = Number(normalizeNumber(quantity));
    const prc = Number(normalizeNumber(price));
    return (qty * prc).toFixed(8).replace(/\.?0+$/, '');
  } catch {
    return '0';
  }
}

// Auto-detect platform from CSV header
export function detectPlatform(csvContent: string): CexPlatform | null {
  const firstLine = csvContent.split('\n')[0]?.toLowerCase() || '';
  
  // Binance indicators (various formats)
  if ((firstLine.includes('trade id') || firstLine.includes('orderno')) && 
      (firstLine.includes('symbol') || firstLine.includes('pair')) &&
      (firstLine.includes('commission') || firstLine.includes('fee') || firstLine.includes('trading fee'))) {
    return 'binance';
  }
  
  // OKX indicators
  if (firstLine.includes('instid') || (firstLine.includes('fillpx') && firstLine.includes('fillsz'))) {
    return 'okx';
  }
  
  // Bybit indicators
  if (firstLine.includes('execid') || firstLine.includes('execid') || 
      (firstLine.includes('execprice') && firstLine.includes('closedpnl'))) {
    return 'bybit';
  }
  
  // Coinbase indicators
  if (firstLine.includes('portfolio') && firstLine.includes('trade id')) {
    return 'coinbase';
  }
  
  return null;
}

// Validate CSV format without full parsing
export function validateCsvFormat(csvContent: string, platform: CexPlatform): { valid: boolean; error?: string } {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return { valid: false, error: 'CSV must have at least a header and one data row' };
  }

  const firstLine = lines[0];
  if (!firstLine) {
    return { valid: false, error: 'CSV has no header row' };
  }
  const header = firstLine.toLowerCase();
  const requiredFields: Record<CexPlatform, string[]> = {
    binance: ['trade id', 'symbol', 'side', 'price'],
    okx: ['instid', 'side', 'fillpx', 'fillsz'],
    bybit: ['symbol', 'side', 'price', 'qty'],
    coinbase: ['trade id', 'product', 'side', 'price'],
  };

  const missing = requiredFields[platform].filter(field => !header.includes(field));
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields for ${platform}: ${missing.join(', ')}` };
  }

  return { valid: true };
}
