'use client';

import { useState } from 'react';
import {
  AlertTriangle, TrendingDown, TrendingUp, Minus, DollarSign,
  Clock, ChevronDown, ChevronUp, PiggyBank,
} from 'lucide-react';
import { ActionPlan as ActionPlanType, Lot, PortfolioMetrics, isLockedLot } from '@/lib/trading-rules';
import { BandPosition } from '@/lib/band-calculator';

interface Props {
  plan: ActionPlanType | null;
  lots: Lot[];
  currentSellPrice: number;
  bandPosition: BandPosition | null;
  metrics: PortfolioMetrics | null;
  loading?: boolean;
  lastUpdated?: Date | null;
  priceUpdateTime?: string | null;
}

// ── Signal display config ─────────────────────────────────────────────────────

const signalConfig = {
  strong_sell:    { bg: 'bg-red-950 border-red-500',      badge: 'bg-red-500 text-white',    icon: TrendingDown, label: 'STRONG SELL', iconColor: 'text-red-400'    },
  mild_sell:      { bg: 'bg-orange-950 border-orange-500', badge: 'bg-orange-500 text-white', icon: TrendingDown, label: 'MILD SELL',   iconColor: 'text-orange-400' },
  hold:           { bg: 'bg-slate-900 border-slate-600',   badge: 'bg-slate-600 text-white',  icon: Minus,        label: 'HOLD',        iconColor: 'text-slate-400'  },
  buy_back:       { bg: 'bg-blue-950 border-blue-500',     badge: 'bg-blue-500 text-white',   icon: DollarSign,   label: 'BUY BACK',    iconColor: 'text-blue-400'   },
  strong_buy:     { bg: 'bg-green-950 border-green-500',   badge: 'bg-green-500 text-white',  icon: TrendingUp,   label: 'STRONG BUY',  iconColor: 'text-green-400'  },
  mild_buy:       { bg: 'bg-teal-950 border-teal-500',     badge: 'bg-teal-500 text-white',   icon: TrendingUp,   label: 'MILD BUY',    iconColor: 'text-teal-400'   },
  cash_injection: { bg: 'bg-green-950 border-green-500',   badge: 'bg-green-500 text-white',  icon: TrendingUp,   label: 'BUY MORE',    iconColor: 'text-green-400'  },
} as const;

// ── Fresh-capital signal ──────────────────────────────────────────────────────

type GoalSignal = 'add_now' | 'decent_entry' | 'hold_capital' | 'wait';

const goalBadge: Record<GoalSignal, { badge: string; label: string }> = {
  add_now:      { badge: 'bg-green-700 text-white',  label: 'ADD'          },
  decent_entry: { badge: 'bg-teal-700 text-white',   label: 'DECENT ENTRY' },
  hold_capital: { badge: 'bg-slate-600 text-white',  label: 'HOLD CAPITAL' },
  wait:         { badge: 'bg-orange-700 text-white', label: 'WAIT'         },
};

function getGoalSignal(bp: BandPosition, m: PortfolioMetrics): { signal: GoalSignal; headline: string } {
  const { zone, percentAboveSma, sma, upperBand, lowerBand, currentPrice } = bp;
  const belowOwnAvg = currentPrice < m.avgBuyPrice;

  if (zone === 'strong_buy' || zone === 'hold_buy' || belowOwnAvg) {
    return {
      signal: 'add_now',
      headline: belowOwnAvg
        ? 'Price below your avg — fresh capital works hard here'
        : `Near lower band (฿${lowerBand.toLocaleString()}) — good entry for new money`,
    };
  }
  if (percentAboveSma <= 0) {
    return { signal: 'decent_entry', headline: `Near SMA (฿${sma.toLocaleString()}) — reasonable entry for new money` };
  }
  if (zone === 'mild_sell') {
    return { signal: 'hold_capital', headline: 'Price above average — wait before deploying fresh capital' };
  }
  return { signal: 'wait', headline: `Above upper band (฿${upperBand.toLocaleString()}) — do not add fresh capital now` };
}

// ── Top tradable lot ──────────────────────────────────────────────────────────

const NEAR_LOCK_PCT = 35;

function getTopLot(lots: Lot[], sellPrice: number) {
  const indexed = lots.map((lot, i) => ({ lot, lotNumber: i + 1 }));
  const tradable = indexed.filter(({ lot }) => !isLockedLot(lot, sellPrice));
  if (tradable.length === 0) return null;

  const totalInvested = tradable.reduce((s, { lot }) => s + lot.weight * lot.buy_price, 0);
  const totalWeight   = tradable.reduce((s, { lot }) => s + lot.weight, 0);
  const currentAvg    = Math.round(totalInvested / totalWeight);

  // Highest cost first; skip near-lock lots (P&L 35–40%)
  const sorted = [...tradable].sort((a, b) => b.lot.buy_price - a.lot.buy_price);
  const top = sorted.find(({ lot }) => ((sellPrice - lot.buy_price) / lot.buy_price) * 100 < NEAR_LOCK_PCT);
  if (!top) return null;

  const profitPerBaht = sellPrice - top.lot.buy_price;
  const totalProfit   = profitPerBaht * top.lot.weight;
  const profitPct     = (profitPerBaht / top.lot.buy_price) * 100;
  const remainingInvested = totalInvested - top.lot.weight * top.lot.buy_price;
  const remainingWeight   = totalWeight   - top.lot.weight;
  const avgAfterSell = remainingWeight > 0 ? Math.round(remainingInvested / remainingWeight) : 0;

  return { ...top, profitPerBaht, totalProfit, profitPct, currentAvg, avgAfterSell };
}

// ── Rebuy tier math ───────────────────────────────────────────────────────────

function computeRebuyTiers(sellWeight: number, sellPrice: number, sma: number, lowerBand: number) {
  const cash        = sellWeight * sellPrice;
  // Rounds down to nearest 5B increment (Thai gold lot convention)
  const smaBricks   = Math.floor(cash / sma / 5) * 5;
  const lowerBricks = Math.floor(cash / lowerBand / 5) * 5;
  return {
    cash,
    smaPrice:     Math.round(sma),
    smaBricks,
    smaNet:       smaBricks   - sellWeight,
    smaLeftover:  Math.round(cash - smaBricks   * sma),
    lowerPrice:   Math.round(lowerBand),
    lowerBricks,
    lowerNet:     lowerBricks - sellWeight,
    lowerLeftover: Math.round(cash - lowerBricks * lowerBand),
  };
}

function fmt(n: number) { return n.toLocaleString(); }

// ── Component ─────────────────────────────────────────────────────────────────

export default function TodaysMove({
  plan, lots, currentSellPrice, bandPosition, metrics,
  loading, lastUpdated, priceUpdateTime,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (loading) {
    return (
      <div className="border border-slate-700 rounded-lg p-6 bg-slate-900 animate-pulse">
        <div className="h-3 bg-slate-700 rounded w-24 mb-4" />
        <div className="h-7 bg-slate-700 rounded w-3/4 mb-3" />
        <div className="h-4 bg-slate-700 rounded w-full mb-2" />
        <div className="h-4 bg-slate-700 rounded w-5/6" />
      </div>
    );
  }

  if (!plan) return null;

  const cfg      = signalConfig[plan.signal];
  const Icon     = cfg.icon;
  const isSell   = plan.signal === 'strong_sell' || plan.signal === 'mild_sell';
  const sellWeight = plan.signal === 'strong_sell' ? 10 : 5;

  const topLot = isSell && currentSellPrice > 0 ? getTopLot(lots, currentSellPrice) : null;
  const rebuy  = isSell && bandPosition && topLot
    ? computeRebuyTiers(sellWeight, currentSellPrice, bandPosition.sma, bandPosition.lowerBand)
    : null;

  const goalInfo = bandPosition && metrics ? getGoalSignal(bandPosition, metrics) : null;
  const goalCfg  = goalInfo ? goalBadge[goalInfo.signal] : null;

  const detailParagraphs = plan.detail.split('\n\n');

  return (
    <div className={`border-2 rounded-lg overflow-hidden ${cfg.bg}`}>

      {/* ── Section 1: Signal ──────────────────────────────────────────── */}
      <div className="p-6">

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Today's Move</span>
          {(lastUpdated || priceUpdateTime) && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              <span className="text-xs text-slate-600">
                {lastUpdated && lastUpdated.toLocaleTimeString('th-TH', {
                  timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
                })} ICT
                {priceUpdateTime && <span className="text-slate-700 ml-1">· {priceUpdateTime}</span>}
              </span>
            </div>
          )}
        </div>

        {/* Badge row */}
        <div className="flex items-center gap-3 mb-4">
          <Icon className={`w-7 h-7 ${cfg.iconColor}`} />
          <span className={`text-xs font-bold px-3 py-1 rounded-full tracking-wide ${cfg.badge}`}>{cfg.label}</span>
          {plan.cashWarning && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
              <Clock className="w-3 h-3" />
              30-day clock running!
            </span>
          )}
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold text-white mb-3 leading-snug">{plan.headline}</h2>

        {/* First paragraph always visible; rest behind "Why?" */}
        <p className="text-sm text-slate-300 leading-relaxed">{detailParagraphs[0]}</p>
        {detailParagraphs.length > 1 && (
          <>
            <button
              onClick={() => setDetailOpen(v => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-2 transition-colors"
            >
              {detailOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {detailOpen ? 'Less detail' : 'Why?'}
            </button>
            {detailOpen && (
              <div className="mt-3 space-y-2">
                {detailParagraphs.slice(1).map((block, i) => (
                  <p key={i} className="text-sm text-slate-400 leading-relaxed">{block}</p>
                ))}
              </div>
            )}
          </>
        )}

        {/* Day counter for cash-in-hand state */}
        {plan.daysSinceSale !== undefined && plan.daysSinceSale > 0 && (
          <div className={`mt-3 text-xs ${plan.daysSinceSale >= 25 ? 'text-yellow-400' : 'text-slate-400'}`}>
            Day {plan.daysSinceSale} of 30-day redeployment window
          </div>
        )}

        {/* Math check for buy_back signal */}
        {plan.mathVerification && (
          <div className="bg-black/40 rounded-lg p-4 mt-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Math Check</span>
            </div>
            <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed">
              {plan.mathVerification}
            </pre>
          </div>
        )}
      </div>

      {/* ── Section 2: Which lot to sell ───────────────────────────────── */}
      {isSell && topLot && (
        <div className="border-t border-white/10 bg-black/20 px-6 py-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Sell This Lot First</div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-bold text-white">Lot {topLot.lotNumber}</span>
                <span className="text-sm text-slate-400">{topLot.lot.weight}B</span>
                <span className="text-xs font-mono text-slate-500">bought ฿{fmt(topLot.lot.buy_price)}</span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-slate-500">Profit/baht</div>
                  <div className="text-sm font-mono font-semibold text-green-400">+฿{fmt(topLot.profitPerBaht)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Total profit</div>
                  <div className="text-lg font-bold text-green-400">+฿{fmt(topLot.totalProfit)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Return</div>
                  <div className="text-sm font-semibold text-green-600">+{topLot.profitPct.toFixed(1)}%</div>
                </div>
              </div>
            </div>
            {topLot.avgAfterSell > 0 && (
              <div className="text-right self-end">
                <div className="text-xs text-slate-500">Tradable avg after</div>
                <div className="text-xs font-mono">
                  <span className="text-slate-400">฿{fmt(topLot.currentAvg)}</span>
                  <span className="text-slate-600 mx-1">→</span>
                  <span className="text-green-400">฿{fmt(topLot.avgAfterSell)}</span>
                  <span className="text-green-700 ml-1">(↓฿{fmt(Math.abs(topLot.avgAfterSell - topLot.currentAvg))})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Rebuy target ─────────────────────────────────────── */}
      {isSell && rebuy && (
        <div className="border-t border-white/10 bg-black/20 px-6 py-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">
            Then wait to rebuy — sell {sellWeight}B → ฿{fmt(rebuy.cash)} cash
          </div>
          <div className="space-y-2">

            {/* SMA row — highlighted on mild_sell (fast strategy) */}
            <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 border ${
              plan.rebuyStrategy === 'fast'
                ? 'bg-amber-900/30 border-amber-700/60'
                : 'bg-slate-800/30 border-slate-700/20'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20">SMA</span>
                <span className="text-xs font-mono text-slate-300">฿{fmt(rebuy.smaPrice)}</span>
                {plan.rebuyStrategy === 'fast' && (
                  <span className="text-xs font-bold text-amber-400 ml-1">← aim here</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-xs font-mono text-slate-400">{rebuy.smaBricks}B back</span>
                {rebuy.smaNet > 0
                  ? <span className="text-xs font-mono text-green-400">+{rebuy.smaNet}B</span>
                  : <span className="text-xs font-mono text-slate-500">+฿{fmt(rebuy.smaLeftover)} leftover</span>
                }
              </div>
            </div>

            {/* Lower band row — highlighted on strong_sell (patient strategy) */}
            <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 border ${
              plan.rebuyStrategy === 'patient'
                ? 'bg-amber-900/30 border-amber-700/60'
                : 'bg-slate-800/30 border-slate-700/20'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20">Lower band</span>
                <span className="text-xs font-mono text-slate-300">฿{fmt(rebuy.lowerPrice)}</span>
                {plan.rebuyStrategy === 'patient' && (
                  <span className="text-xs font-bold text-amber-400 ml-1">← aim here</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-xs font-mono text-slate-400">{rebuy.lowerBricks}B back</span>
                {rebuy.lowerNet > 0
                  ? <span className="text-xs font-mono text-green-400">+{rebuy.lowerNet}B</span>
                  : <span className="text-xs font-mono text-slate-500">+฿{fmt(rebuy.lowerLeftover)} leftover</span>
                }
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Section 4: Fresh capital signal ────────────────────────────── */}
      {goalInfo && goalCfg && (
        <div className="border-t border-white/10 bg-black/20 px-6 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <PiggyBank className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium flex-shrink-0">Fresh Capital</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${goalCfg.badge}`}>{goalCfg.label}</span>
            <span className="text-xs text-slate-400 leading-snug">{goalInfo.headline}</span>
          </div>
        </div>
      )}

    </div>
  );
}
