import { describe, expect, it } from 'vitest';

import {
  calculateAssetPnl,
  calculatePortfolioPnl,
  groupTradesByAsset,
  calculateAnnualizedReturn,
  generateHackathonSubmission,
  type ParsedTrade,
} from '../index.js';

const createTrade = (
  overrides: Partial<ParsedTrade> = {},
): ParsedTrade => ({
  tradeId: '123',
  symbol: 'BTCUSDT',
  asset: 'BTC',
  quoteAsset: 'USDT',
  side: 'buy',
  quantity: '1.0',
  price: '40000',
  quoteQuantity: '40000',
  fee: '40',
  feeAsset: 'USDT',
  tradeTime: new Date('2024-01-15 10:00:00'),
  raw: {},
  ...overrides,
});

describe('PnL Calculator', () => {
  describe('calculateAssetPnl', () => {
    it('calculates simple buy/sell PnL with FIFO', () => {
      const trades = [
        createTrade({ side: 'buy', quantity: '1.0', price: '40000', tradeTime: new Date('2024-01-15') }),
        createTrade({ side: 'sell', quantity: '1.0', price: '44000', tradeTime: new Date('2024-01-16') }),
      ];

      const result = calculateAssetPnl(trades, { method: 'fifo', includeFees: false });

      expect(result.asset).toBe('BTC');
      expect(result.summary.realizedPnl).toBe('4000.00'); // (44000 - 40000) * 1
      expect(result.trades[1]?.realizedPnl).toBe('4000');
    });

    it('includes fees in PnL calculation', () => {
      const trades = [
        createTrade({ side: 'buy', fee: '40' }),
        createTrade({ side: 'sell', price: '44000', fee: '44' }),
      ];

      const result = calculateAssetPnl(trades, { method: 'fifo', includeFees: true });

      // PnL = (44000 - 40000) - 40 - 44 = 4000 - 84 = 3916
      expect(result.summary.totalFees).toBe('84.00');
      expect(result.summary.netPnl).toBe('3916.00');
    });

    it('calculates multiple buy/sell with FIFO correctly', () => {
      const trades = [
        createTrade({ side: 'buy', quantity: '1.0', price: '40000', tradeTime: new Date('2024-01-15') }),
        createTrade({ side: 'buy', quantity: '1.0', price: '42000', tradeTime: new Date('2024-01-16') }),
        createTrade({ side: 'sell', quantity: '1.5', price: '45000', tradeTime: new Date('2024-01-17') }),
      ];

      const result = calculateAssetPnl(trades, { method: 'fifo', includeFees: false });

      // FIFO: Sell 1.0 @ 40000 + 0.5 @ 42000
      // Cost basis: 40000 + 21000 = 61000
      // Proceeds: 1.5 * 45000 = 67500
      // PnL: 67500 - 61000 = 6500
      expect(result.summary.realizedPnl).toBe('6500.00');
      expect(result.summary.openPosition).toBe('0.5'); // 0.5 @ 42000 remaining
    });

    it('calculates LIFO correctly', () => {
      const trades = [
        createTrade({ side: 'buy', quantity: '1.0', price: '40000' }),
        createTrade({ side: 'buy', quantity: '1.0', price: '42000' }),
        createTrade({ side: 'sell', quantity: '1.0', price: '45000' }),
      ];

      const result = calculateAssetPnl(trades, { method: 'lifo', includeFees: false });

      // LIFO: Sell 1.0 @ 42000
      // PnL: (45000 - 42000) * 1 = 3000
      expect(result.summary.realizedPnl).toBe('3000.00');
    });

    it('calculates average cost correctly', () => {
      const trades = [
        createTrade({ side: 'buy', quantity: '1.0', price: '40000' }),
        createTrade({ side: 'buy', quantity: '1.0', price: '42000' }),
        createTrade({ side: 'sell', quantity: '1.0', price: '45000' }),
      ];

      const result = calculateAssetPnl(trades, { method: 'avg', includeFees: false });

      // Avg cost: (40000 + 42000) / 2 = 41000
      // PnL: (45000 - 41000) * 1 = 4000
      expect(result.summary.realizedPnl).toBe('4000.00');
    });

    it('tracks win/loss statistics', () => {
      const trades = [
        createTrade({ side: 'buy', quantity: '1.0', price: '40000' }),
        createTrade({ side: 'sell', quantity: '1.0', price: '44000' }), // Win
        createTrade({ side: 'buy', quantity: '1.0', price: '44000' }),
        createTrade({ side: 'sell', quantity: '1.0', price: '42000' }), // Loss
      ];

      const result = calculateAssetPnl(trades, { method: 'fifo', includeFees: false });

      expect(result.summary.winningTrades).toBe(1);
      expect(result.summary.losingTrades).toBe(1);
      expect(result.summary.winRatePct).toBe('50.00');
    });

    it('calculates largest win and loss', () => {
      const trades = [
        createTrade({ side: 'buy', quantity: '1.0', price: '40000' }),
        createTrade({ side: 'sell', quantity: '1.0', price: '45000' }), // +5000
        createTrade({ side: 'buy', quantity: '1.0', price: '45000' }),
        createTrade({ side: 'sell', quantity: '1.0', price: '42000' }), // -3000
      ];

      const result = calculateAssetPnl(trades, { method: 'fifo', includeFees: false });

      expect(result.summary.largestWin).toBe('5000.00');
      expect(result.summary.largestLoss).toBe('-3000.00');
    });

    it('throws error for empty trades', () => {
      expect(() => calculateAssetPnl([], { method: 'fifo', includeFees: true }))
        .toThrow('No trades provided');
    });
  });

  describe('calculatePortfolioPnl', () => {
    it('calculates PnL for multiple assets', () => {
      const tradesByAsset = new Map([
        ['BTC', [
          createTrade({ asset: 'BTC', side: 'buy', price: '40000' }),
          createTrade({ asset: 'BTC', side: 'sell', price: '44000' }),
        ]],
        ['ETH', [
          createTrade({ asset: 'ETH', symbol: 'ETHUSDT', side: 'buy', price: '2000', quantity: '10' }),
          createTrade({ asset: 'ETH', symbol: 'ETHUSDT', side: 'sell', price: '2200', quantity: '10' }),
        ]],
      ]);

      const result = calculatePortfolioPnl(tradesByAsset, { method: 'fifo', includeFees: false });

      expect(result.assets).toHaveLength(2);
      expect(result.summary.uniqueAssets).toBe(2);
      expect(result.summary.totalTrades).toBe(4);
      // BTC: +4000, ETH: +2000
      expect(result.summary.totalRealizedPnl).toBe('6000.00');
    });

    it('counts winning and losing assets', () => {
      const tradesByAsset = new Map([
        ['BTC', [
          createTrade({ asset: 'BTC', side: 'buy', price: '40000' }),
          createTrade({ asset: 'BTC', side: 'sell', price: '44000' }), // Win
        ]],
        ['ETH', [
          createTrade({ asset: 'ETH', symbol: 'ETHUSDT', side: 'buy', price: '2200', quantity: '10' }),
          createTrade({ asset: 'ETH', symbol: 'ETHUSDT', side: 'sell', price: '2000', quantity: '10' }), // Loss
        ]],
      ]);

      const result = calculatePortfolioPnl(tradesByAsset, { method: 'fifo', includeFees: false });

      expect(result.summary.winningAssets).toBe(1);
      expect(result.summary.losingAssets).toBe(1);
    });
  });

  describe('groupTradesByAsset', () => {
    it('groups trades by asset correctly', () => {
      const trades = [
        createTrade({ asset: 'BTC' }),
        createTrade({ asset: 'BTC' }),
        createTrade({ asset: 'ETH', symbol: 'ETHUSDT' }),
      ];

      const grouped = groupTradesByAsset(trades);

      expect(grouped.get('BTC')).toHaveLength(2);
      expect(grouped.get('ETH')).toHaveLength(1);
    });
  });

  describe('calculateAnnualizedReturn', () => {
    it('calculates annualized return correctly', () => {
      // 10% return over 30 days
      const annualized = calculateAnnualizedReturn('1000', '10000', 30);
      // (1000/10000) * (365/30) * 100 = 121.67%
      expect(Number(annualized)).toBeCloseTo(121.67, 0);
    });

    it('returns 0 for zero trading days', () => {
      const annualized = calculateAnnualizedReturn('1000', '10000', 0);
      expect(annualized).toBe('0');
    });

    it('returns 0 for zero capital', () => {
      const annualized = calculateAnnualizedReturn('1000', '0', 30);
      expect(annualized).toBe('0');
    });
  });

  describe('generateHackathonSubmission', () => {
    it('generates submission format correctly', () => {
      const tradesByAsset = new Map([
        ['BTC', [
          createTrade({ asset: 'BTC', side: 'buy', price: '40000' }),
          createTrade({ asset: 'BTC', side: 'sell', price: '44000' }),
        ]],
      ]);

      const portfolioPnl = calculatePortfolioPnl(tradesByAsset, { method: 'fifo', includeFees: false });
      const submission = generateHackathonSubmission(
        portfolioPnl,
        'sleeve-1',
        'strategy-1',
        '100000',
        'cex_verified',
      );

      expect(submission.sleeveId).toBe('sleeve-1');
      expect(submission.strategyId).toBe('strategy-1');
      expect(submission.assets).toHaveLength(1);
      expect(submission.assets[0]?.asset).toBe('BTC');
      expect(submission.summary.totalRealizedPnlUsd).toBeDefined();
      expect(submission.summary.annualizedReturnPct).toBeDefined();
      expect(submission.evidence.verificationStatus).toBe('cex_verified');
      expect(submission.evidence.calculationMethod).toBe('fifo');
      expect(submission.evidence.tradeHistoryHash).toBeDefined();
    });

    it('calculates win rate correctly', () => {
      const tradesByAsset = new Map([
        ['BTC', [
          createTrade({ asset: 'BTC', side: 'buy', price: '40000' }),
          createTrade({ asset: 'BTC', side: 'sell', price: '44000' }), // Win
          createTrade({ asset: 'BTC', side: 'buy', price: '44000' }),
          createTrade({ asset: 'BTC', side: 'sell', price: '42000' }), // Loss
        ]],
      ]);

      const portfolioPnl = calculatePortfolioPnl(tradesByAsset, { method: 'fifo', includeFees: false });
      const submission = generateHackathonSubmission(portfolioPnl, 's', 'st', '100000');

      expect(submission.summary.winRatePct).toBe('50.00');
    });
  });
});
