'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Lot, isLockedLot } from '@/lib/trading-rules';

interface Props {
  lots: Lot[];
  currentSellPrice: number;
  actionPlanSignal?: string;
}

interface LotAnalysis {
  lot: Lot;
  lotNumber: number;
  rank: number;
  profitPerBaht: number;
  totalProfit: number;
  profitPct: number;
  avgAfterSell: number;
  avgDrop: number;
  verdict: 'sell_first' | 'available' | 'near_lock';
}

const NEAR_LOCK_PCT = 35;

function analyze(lots: Lot[], sellPrice: number) {
  const tradable = lots
    .map((lot, i) => ({ lot, lotNumber: i + 1 }))
    .filter(({ lot }) => !isLockedLot(lot, sellPrice));

  if (tradable.length === 0) return { analyses: [], currentAvg: 0, totalWeight: 0 };

  const totalInvested = tradable.reduce((s, { lot }) => s + lot.weight * lot.buy_price, 0);
  const totalWeight   = tradable.reduce((s, { lot }) => s + lot.weight, 0);
  const currentAvg    = Math.round(totalInvested / totalWeight);

  const sorted = [...tradable].sort((a, b) => b.lot.buy_price - a.lot.buy_price);

  const analyses: LotAnalysis[] = sorted.map(({ lot, lotNumber }, i) => {
    const profitPerBaht = sellPrice - lot.buy_price;
    const totalProfit   = profitPerBaht * lot.weight;
    const profitPct     = (profitPerBaht / lot.buy_price) * 100;
    const remainingInvested = totalInvested - lot.weight * lot.buy_price;
    const remainingWeight   = totalWeight - lot.weight;
    const avgAfterSell = remainingWeight > 0 ? Math.round(remainingInvested / remainingWeight) : 0;
    const avgDrop = avgAfterSell - currentAvg;
    const nearLock = profitPct >= NEAR_LOCK_PCT;

    return {
      lot, lotNumber, rank: i + 1,
      profitPerBaht, totalProfit, profitPct,
      avgAfterSell, avgDrop,
      verdict: nearLock ? 'near_lock' : i === 0 ? 'sell_first' : 'available',
    };
  });

  return { analyses, currentAvg, totalWeight };
}

function fillOrder(analyses: LotAnalysis[], targetWeight: number) {
  const selection: LotAnalysis[] = [];
  let remaining = targetWeight;
  for (const a of analyses) {
    if (remaining <= 0) break;
    if (a.verdict === 'near_lock') continue;
    if (a.lot.weight <= remaining) {
      selection.push(a);
      remaining -= a.lot.weight;
    }
  }
  return selection;
}

function signalTargetWeight(signal?: string): number | null {
  if (signal === 'strong_sell') return 10;
  if (signal === 'mild_sell')   return 5;
  return null;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function TradablePool({ lots, currentSellPrice, actionPlanSignal }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!currentSellPrice) return null;

  const { analyses, currentAvg, totalWeight } = analyze(lots, currentSellPrice);

  if (analyses.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-amber-500 pl-2 mb-2">
          Tradable Pool
        </h3>
        <p className="text-xs text-slate-500">No tradable lots — all lots are forever-locked.</p>
      </div>
    );
  }

  const targetWeight   = signalTargetWeight(actionPlanSignal);
  const recommended    = targetWeight ? fillOrder(analyses, targetWeight) : [];
  const recommendedIds = new Set(recommended.map(a => a.lot.id));
  const top            = analyses.find(a => a.verdict !== 'near_lock');
  const rest           = analyses.slice(1);

  // Total profit if selling entire recommended fill
  const fillCash   = recommended.reduce((s, a) => s + a.lot.weight * currentSellPrice, 0);
  const fillProfit = recommended.reduce((s, a) => s + a.totalProfit, 0);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Which Lot to Sell</span>
          </div>
          <p className="text-xs text-slate-500 pl-4">
            Highest cost first — every sell lowers your tradable avg
          </p>
        </div>
        <span className="text-xs text-slate-600">{analyses.length} lots · {totalWeight}B</span>
      </div>

      {/* ── Top recommendation (always visible) ── */}
      {top && (
        <div className="rounded-lg bg-amber-900/20 border border-amber-700/50 p-4 mb-3">
          {/* Signal fill context */}
          {targetWeight && recommended.length > 0 && (
            <p className="text-xs text-amber-500 font-medium mb-2">
              Signal says sell {targetWeight}B →{' '}
              {recommended.map(a => `Lot ${a.lotNumber} (${a.lot.weight}B)`).join(' + ')}
            </p>
          )}

          {/* Lot headline */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-amber-600">#1 sell first</span>
                <span className="text-base font-bold text-white">Lot {top.lotNumber}</span>
                <span className="text-sm text-slate-400">{top.lot.weight}B</span>
                <span className="text-xs font-mono text-slate-500">bought ฿{fmt(top.lot.buy_price)}</span>
              </div>

              {/* Profit breakdown */}
              <div className="space-y-1">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Profit per baht</div>
                    <div className="text-sm font-mono font-semibold text-green-400">
                      +฿{fmt(top.profitPerBaht)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Total profit locked</div>
                    <div className="text-lg font-bold text-green-400">
                      +฿{fmt(top.totalProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Return</div>
                    <div className="text-sm font-semibold text-green-600">
                      +{top.profitPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Avg impact + cash */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-amber-800/30 flex-wrap">
            <div>
              <span className="text-xs text-slate-500">Cash received  </span>
              <span className="text-xs font-mono text-slate-300">฿{fmt(top.lot.weight * currentSellPrice)}</span>
            </div>
            {top.avgAfterSell > 0 && (
              <div>
                <span className="text-xs text-slate-500">Tradable avg  </span>
                <span className="text-xs font-mono text-slate-400">฿{fmt(currentAvg)}</span>
                <span className="text-xs text-slate-600 mx-1">→</span>
                <span className="text-xs font-mono text-green-400">฿{fmt(top.avgAfterSell)}</span>
                <span className="text-xs text-green-700 ml-1">(↓฿{fmt(Math.abs(top.avgDrop))})</span>
              </div>
            )}
            {/* Multi-lot fill totals if different from single top lot */}
            {recommended.length > 1 && (
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-500">Full {targetWeight}B fill</div>
                <div className="text-xs font-mono text-green-400">+฿{fmt(fillProfit)} profit · ฿{fmt(fillCash)} cash</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rest of lots (collapsible) ── */}
      {rest.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-xs text-slate-400 hover:text-slate-200"
          >
            <span>{expanded ? 'Hide' : 'Show'} {rest.length} more lot{rest.length > 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5">
              {rest.map(a => {
                const isRec = recommendedIds.has(a.lot.id);
                const nearLock = a.verdict === 'near_lock';

                return (
                  <div
                    key={a.lot.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border text-xs ${
                      isRec
                        ? 'bg-amber-900/15 border-amber-800/40'
                        : nearLock
                        ? 'bg-purple-900/10 border-purple-800/30'
                        : 'bg-slate-800/30 border-slate-700/20'
                    }`}
                  >
                    <span className="font-mono text-slate-600 w-4 flex-shrink-0">#{a.rank}</span>
                    <span className="font-semibold text-slate-300 w-10 flex-shrink-0">
                      Lot {a.lotNumber}
                    </span>
                    <span className="text-slate-500 w-8 flex-shrink-0">{a.lot.weight}B</span>
                    <span className="font-mono text-slate-500 flex-shrink-0">
                      ฿{fmt(a.lot.buy_price)}
                    </span>
                    <span className={`font-mono flex-shrink-0 ${nearLock ? 'text-purple-400' : 'text-green-500'}`}>
                      +฿{fmt(a.totalProfit)}
                    </span>
                    <span className={`flex-shrink-0 ${nearLock ? 'text-purple-500' : 'text-slate-600'}`}>
                      +{a.profitPct.toFixed(1)}%
                    </span>
                    {a.avgAfterSell > 0 && !nearLock && (
                      <span className="text-slate-700 ml-auto">
                        avg → <span className="text-green-700">฿{fmt(a.avgAfterSell)}</span>
                      </span>
                    )}
                    {nearLock && (
                      <span className="text-purple-600 ml-auto">near lock — hold</span>
                    )}
                    {isRec && !nearLock && (
                      <span className="text-amber-600 ml-auto">fill</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
