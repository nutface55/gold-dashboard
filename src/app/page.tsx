'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import ActionPlan from '@/components/ActionPlan';
import BandPosition from '@/components/BandPosition';
import CashTracker from '@/components/CashTracker';
import PortfolioMetrics from '@/components/PortfolioMetrics';
import ScenarioGrid from '@/components/ScenarioGrid';
import LotTable from '@/components/LotTable';
import TradingViewChart from '@/components/TradingViewChart';
import CycleHistory from '@/components/CycleHistory';

import { GoldPrice } from '@/lib/price-fetcher';
import { Lot, CashState, computePortfolioMetrics, generateActionPlan } from '@/lib/trading-rules';
import { calculateBollingerBands, getBandPosition, generateSyntheticHistory, BandData, BandPosition as BandPositionType } from '@/lib/band-calculator';

// Seed lots for when DB isn't initialized yet
const SEED_LOTS: Lot[] = [
  { id: 1, date_bought: '2025-05-24', weight: 10, buy_price: 51120, notes: 'Ausiris', is_forever: false },
  { id: 2, date_bought: '2025-05-31', weight: 10, buy_price: 51070, notes: 'Ausiris', is_forever: false },
  { id: 3, date_bought: '2025-08-09', weight: 10, buy_price: 50700, notes: 'Ausiris', is_forever: false },
  { id: 4, date_bought: '2025-11-04', weight: 5,  buy_price: 61000, notes: 'Ausiris', is_forever: false },
  { id: 5, date_bought: '2026-02-02', weight: 5,  buy_price: 68350, notes: 'Ausiris', is_forever: false },
  { id: 6, date_bought: '2026-03-06', weight: 10, buy_price: 77300, notes: 'Ausiris', is_forever: false },
  { id: 7, date_bought: '2026-03-20', weight: 5,  buy_price: 76500, notes: 'Ausiris', is_forever: false },
  { id: 8, date_bought: '2026-03-21', weight: 5,  buy_price: 74850, notes: 'Ausiris', is_forever: false },
  { id: 9, date_bought: '2026-03-27', weight: 5,  buy_price: 68950, notes: 'Ausiris', is_forever: false },
];

interface PriceHistoryPoint {
  date: string;
  price: number;
}

export default function Dashboard() {
  const [price, setPrice] = useState<GoldPrice | null>(null);
  const [lots, setLots] = useState<Lot[]>(SEED_LOTS);
  const [cashState, setCashState] = useState<CashState | null>(null);
  const [cycles, setCycles] = useState<Parameters<typeof CycleHistory>[0]['cycles']>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [initAttempted, setInitAttempted] = useState(false);

  const fetchPrice = async (): Promise<GoldPrice | null> => {
    try {
      const res = await fetch('/api/prices');
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  };

  const fetchLots = async (): Promise<Lot[]> => {
    try {
      const res = await fetch('/api/lots');
      if (!res.ok) return SEED_LOTS;
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data : SEED_LOTS;
    } catch { return SEED_LOTS; }
  };

  const fetchCash = async (): Promise<CashState | null> => {
    try {
      const res = await fetch('/api/cash');
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  };

  const fetchCycles = async (): Promise<Parameters<typeof CycleHistory>[0]['cycles']> => {
    try {
      const res = await fetch('/api/cycles');
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  };

  const fetchPriceHistory = async (): Promise<PriceHistoryPoint[]> => {
    try {
      const res = await fetch('/api/prices', { method: 'POST' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((p: { timestamp: string; gold_bar_sell: number }) => ({
        date: p.timestamp,
        price: p.gold_bar_sell,
      }));
    } catch { return []; }
  };

  const initDb = async () => {
    try {
      const res = await fetch('/api/init', { method: 'POST' });
      const data = await res.json();
      if (!data.success) setDbError(data.error || 'DB init failed');
      return data.success;
    } catch (e) {
      setDbError(String(e));
      return false;
    }
  };

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      if (!initAttempted) {
        setInitAttempted(true);
        await initDb();
      }

      const [fetchedPrice, fetchedLots, fetchedCash, fetchedCycles, history] = await Promise.all([
        fetchPrice(),
        fetchLots(),
        fetchCash(),
        fetchCycles(),
        fetchPriceHistory(),
      ]);

      if (fetchedPrice) setPrice(fetchedPrice);
      setLots(fetchedLots);
      setCashState(fetchedCash);
      setCycles(fetchedCycles);
      setPriceHistory(history);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAttempted]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => loadAll(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Derived state
  const currentSellPrice = price?.barSell || 0;
  const currentBuyPrice = price?.barBuy || 0;

  const totalWeight = lots.reduce((s, l) => s + l.weight, 0);
  const totalInvested = lots.reduce((s, l) => s + l.weight * l.buy_price, 0);
  const avgBuyPrice = totalWeight > 0 ? Math.round(totalInvested / totalWeight) : 62310;

  // Bollinger Bands
  let bands: BandData | null = null;
  let bandPosition: BandPositionType | null = null;
  const usePrice = currentSellPrice || currentBuyPrice;

  if (usePrice > 0) {
    const histPrices = priceHistory.length >= 5
      ? priceHistory.map(p => p.price)
      : generateSyntheticHistory(usePrice, avgBuyPrice, 60);

    bands = calculateBollingerBands(histPrices);
    bandPosition = getBandPosition(usePrice, bands);
  }

  const metrics = computePortfolioMetrics(lots, usePrice || avgBuyPrice);

  const actionPlan = bandPosition && metrics
    ? generateActionPlan(bandPosition, metrics, cashState, lots, usePrice)
    : null;

  const isMarketOpen = () => {
    const h = new Date().getHours();
    return h >= 7 || h < 4;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-yellow-400">Gold Dashboard</h1>
            <p className="text-xs text-zinc-500">96.5% Thai Gold — {totalWeight}B → 150B target</p>
          </div>
          <div className="flex items-center gap-3">
            {price && price.barSell > 0 && (
              <div className="text-right">
                <div className="text-sm font-bold text-white">
                  ฿{currentSellPrice.toLocaleString()}
                  <span className="text-xs text-zinc-500 ml-1">sell</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {price.source} ·{' '}
                  {isMarketOpen() ? (
                    <span className="text-green-400"><Wifi className="inline w-3 h-3 mr-0.5" />Live</span>
                  ) : (
                    <span className="text-zinc-500"><WifiOff className="inline w-3 h-3 mr-0.5" />Closed</span>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* DB Error */}
        {dbError && (
          <div className="flex items-start gap-3 bg-yellow-950 border border-yellow-700 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-300">Database not connected — showing seed data</p>
              <p className="text-xs text-yellow-600 mt-1">Set DATABASE_URL in your .env.local to enable persistence.</p>
            </div>
          </div>
        )}

        {/* Price unavailable */}
        {!loading && usePrice === 0 && (
          <div className="flex items-start gap-3 bg-red-950 border border-red-700 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Live price unavailable</p>
              <p className="text-xs text-red-600 mt-1">All price sources failed. Market may be closed. Refresh to try again.</p>
            </div>
          </div>
        )}

        {/* 1. Action Plan */}
        <ActionPlan plan={actionPlan} loading={loading} />

        {/* 2. Band Position */}
        <BandPosition bandPosition={bandPosition} loading={loading} />

        {/* 3. Portfolio Metrics */}
        <PortfolioMetrics metrics={metrics} loading={loading} />

        {/* 4. TradingView Chart */}
        <TradingViewChart />

        {/* 5. Cash Tracker */}
        <CashTracker
          cashState={cashState}
          currentPrice={usePrice || avgBuyPrice}
          sma={bands?.sma || avgBuyPrice}
          lowerBand={bands?.lowerBand || Math.round(avgBuyPrice * 0.94)}
          onUpdate={() => loadAll(true)}
        />

        {/* 6. Scenario Comparison */}
        {bands && usePrice > 0 && (
          <ScenarioGrid
            currentPrice={usePrice}
            sma={bands.sma}
            lowerBand={bands.lowerBand}
            cashInHand={cashState?.amount}
          />
        )}

        {/* 7. Lot Inventory */}
        <LotTable
          lots={lots}
          currentSellPrice={usePrice || avgBuyPrice}
          onUpdate={() => loadAll(true)}
        />

        {/* 8. Cycle History */}
        <CycleHistory cycles={cycles} onUpdate={() => loadAll(true)} />

        {lastUpdated && (
          <p className="text-center text-xs text-zinc-700 pb-4">
            Last updated: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 5 min
          </p>
        )}
      </main>
    </div>
  );
}
