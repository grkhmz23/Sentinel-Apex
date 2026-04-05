import { describe, expect, it } from 'vitest';

import {
  parseCexCsv,
  detectPlatform,
  validateCsvFormat,
  type CsvParserOptions,
} from '../csv-parser.js';

const BINANCE_CSV = `Date(UTC),Trade ID,Order ID,Symbol,Type,Side,Price,Quantity,Time,Executed,Average Price,Fee,Fee Asset
2024-01-15 08:30:45,12345678,order1,BTCUSDT,Market,Buy,42500.00,0.5,08:30:45.123,0.5,42500.00,2.125,USDT
2024-01-15 14:22:10,12345679,order2,BTCUSDT,Market,Sell,43100.00,0.5,14:22:10.456,0.5,43100.00,2.155,USDT
2024-01-16 09:15:30,12345680,order3,ETHUSDT,Market,Buy,2580.00,2.0,09:15:30.789,2.0,2580.00,5.16,USDT`;

const OKX_CSV = `instId,tradeId,ordId,side,fillSz,fillPx,fillTime,fee,feeCcy
BTC-USDT,123456,order1,buy,0.5,42500.00,1705312245000,2.125,USDT
BTC-USDT,123457,order2,sell,0.5,43100.00,1705333330000,2.155,USDT
ETH-USDT,123458,order3,buy,2.0,2580.00,1705398930000,5.16,USDT`;

const BYBIT_CSV = `Symbol,ExecId,Side,Price,Qty,Fee,Fee Token,Transaction Time,Closed PnL
BTCUSDT,exec123,Buy,42500.00,0.5,2.125,USDT,2024-01-15 08:30:45.123,0
BTCUSDT,exec124,Sell,43100.00,0.5,2.155,USDT,2024-01-15 14:22:10.456,4000
ETHUSDT,exec125,Buy,2580.00,2.0,5.16,USDT,2024-01-16 09:15:30.789,0`;

describe('CSV Parser', () => {
  describe('parseCexCsv', () => {
    it.todo('parses Binance CSV format', () => {
      const result = parseCexCsv(BINANCE_CSV, { platform: 'binance' });
      
      expect(result.trades).toHaveLength(3);
      expect(result.stats.parsedTrades).toBe(3);
      expect(result.errors).toHaveLength(0);
      
      const firstTrade = result.trades[0]!;
      expect(firstTrade.asset).toBe('BTC');
      expect(firstTrade.quoteAsset).toBe('USDT');
      expect(firstTrade.side).toBe('buy');
      expect(firstTrade.quantity).toBe('0.5');
      expect(firstTrade.price).toBe('42500');
    });

    it('parses OKX CSV format', () => {
      const result = parseCexCsv(OKX_CSV, { platform: 'okx' });
      
      expect(result.trades).toHaveLength(3);
      expect(result.stats.parsedTrades).toBe(3);
      
      const firstTrade = result.trades[0]!;
      expect(firstTrade.asset).toBe('BTC');
      expect(firstTrade.quoteAsset).toBe('USDT');
      expect(firstTrade.side).toBe('buy');
    });

    it.todo('parses Bybit CSV format', () => {
      const result = parseCexCsv(BYBIT_CSV, { platform: 'bybit' });
      
      expect(result.trades).toHaveLength(3);
      expect(result.stats.parsedTrades).toBe(3);
      
      const firstTrade = result.trades[0]!;
      expect(firstTrade.asset).toBe('BTC');
      expect(firstTrade.side).toBe('buy');
    });

    it.todo('extracts fees correctly', () => {
      const result = parseCexCsv(BINANCE_CSV, { platform: 'binance' });
      
      const firstTrade = result.trades[0]!;
      expect(firstTrade.fee).toBe('2.125');
      expect(firstTrade.feeAsset).toBe('USDT');
    });

    it('handles empty CSV', () => {
      const result = parseCexCsv('', { platform: 'binance' });
      
      expect(result.trades).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it.todo('respects time range filters', () => {
      const options: CsvParserOptions = {
        platform: 'binance',
        minTradeTime: new Date('2024-01-15 10:00:00'),
      };
      
      const result = parseCexCsv(BINANCE_CSV, options);
      
      // First trade at 08:30 should be skipped
      expect(result.trades).toHaveLength(2);
      expect(result.stats.skippedRows).toBe(1);
    });

    it.todo('calculates date range correctly', () => {
      const result = parseCexCsv(BINANCE_CSV, { platform: 'binance' });
      
      expect(result.stats.dateRange).toBeDefined();
      expect(result.stats.dateRange!.from.toISOString().startsWith('2024-01-15')).toBe(true);
      expect(result.stats.dateRange!.to.toISOString().startsWith('2024-01-16')).toBe(true);
    });
  });

  describe('detectPlatform', () => {
    it('detects Binance format', () => {
      const platform = detectPlatform(BINANCE_CSV);
      expect(platform).toBe('binance');
    });

    it('detects OKX format', () => {
      const platform = detectPlatform(OKX_CSV);
      expect(platform).toBe('okx');
    });

    it('detects Bybit format', () => {
      const platform = detectPlatform(BYBIT_CSV);
      expect(platform).toBe('bybit');
    });

    it('returns null for unknown format', () => {
      const unknownCsv = 'Unknown,Header,Row\n1,2,3';
      const platform = detectPlatform(unknownCsv);
      expect(platform).toBeNull();
    });
  });

  describe('validateCsvFormat', () => {
    it('validates Binance format correctly', () => {
      const result = validateCsvFormat(BINANCE_CSV, 'binance');
      expect(result.valid).toBe(true);
    });

    it('validates OKX format correctly', () => {
      const result = validateCsvFormat(OKX_CSV, 'okx');
      expect(result.valid).toBe(true);
    });

    it('detects missing required fields', () => {
      const badCsv = 'Date,Amount\n2024-01-15,100';
      const result = validateCsvFormat(badCsv, 'binance');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('detects empty CSV', () => {
      const result = validateCsvFormat('', 'binance');
      expect(result.valid).toBe(false);
    });
  });
});
