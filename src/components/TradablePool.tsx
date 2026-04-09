'use client';

import { Lot, isLockedLot } from '@/lib/trading-rules';

interface Props {
  lots: Lot[];
  currentSellPrice: number;
  actionPlanSignal?: string; // 'strong_sell' | 'mild_sell' etc.
}

interface LotAnalysis {
  lot: Lot;
  lotNumber: number;       // 1-based index in original lots array
  rank: number;            // sell priority rank (1 = sell first)
  profitPerBaht: number;
  totalProfit: number;
  profitPct: number;
  avgAfterSell: number;    // tradable avg if this lot is sold
  avgDrop: number;         // negative = avg goes down (good)
  verdict: 'sell_first' | 'available' | 'near_lock';
}

const NEAR_LOCK_PCT = 35; // warn when approaching the 40% auto-lock threshold

function analyze(lots: Lot[], sellPrice: number): {
  analyses: LotAnalysis[];
  currentAvg: number;
  totalWeight: number;
} {
  const tradable = lots
    .map((lot, i) => ({ lot, lotNumber: i + 1 }))
    .filter(({ lot }) => !isLockedLot(lot, sellPrice));

  if (tradable.length === 0) return { analyses: [], currentAvg: 0, totalWeight: 0 };

  const totalInvested = tradable.reduce((s, { lot }) => s + lot.weight * lot.buy_price, 0);
  const totalWeight   = tradable.reduce((s, { lot }) => s + lot.weight, 0);
  const currentAvg    = Math.round(totalInvested / totalWeight);

  // Sort highest buy price first — selling these lowers the tradable avg fastest
  const sorted = [...tradable].sort((a, b) => b.lot.buy_price - a.lot.buy_price);

  const analyses: LotAnalysis[] = sorted.map(({ lot, lotNumber }, i) => {
    const profitPerBaht = sellPrice - lot.buy_price;
    const totalProfit   = profitPerBaht * lot.weight;
    const profitPct     = (profitPerBaht / lot.buy_price) * 100;

    const remainingInvested = totalInvested - lot.weight * lot.buy_price;
    const remainingWeight   = totalWeight - lot.weight;
    const avgAfterSell = remainingWeight > 0
      ? Math.round(remainingInvested / remainingWeight)
      : 0;
    const avgDrop = avgAfterSell - currentAvg; // negative = avg went down

    const nearLock = profitPct >= NEAR_LOCK_PCT;

    return {
      lot,
      lotNumber,
      rank: i + 1,
      profitPerBaht,
      totalProfit,
      profitPct,
      avgAfterSell,
      avgDrop,
      verdict: nearLock ? 'near_lock' : i === 0 ? 'sell_first' : 'available',
    };
  });

  return { analyses, currentAvg, totalWeight };
}

// Given a target weight to sell, greedily pick top-ranked lots that fill it
function fillOrder(analyses: LotAnalysis[], targetWeight: number): LotAnalysis[] {
  const selection: LotAnalysis[] = [];
  let remaining = targetWeight;
  for (const a of analyses) {
    if (remaining <= 0) break;
    if (a.verdict === 'near_lock') continue; // don't recommend near-lock lots
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

  const targetWeight = signalTargetWeight(actionPlanSignal);
  const recommended  = targetWeight ? fillOrder(analyses, targetWeight) : [];
  const recommendedIds = new Set(recommended.map(a => a.lot.id));

  const topLot = analyses.find(a => a.verdict !== 'near_lock');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-amber-500 pl-2">
          Tradable Pool · Sell Priority
        </h3>
        <span className="text-xs text-slate-600">{analyses.length} lots · {totalWeight}B tradable</span>
      </div>
      <p className="text-xs text-slate-500 mb-4 pl-3">
        Ranked highest cost first — each sell lowers your tradable average
      </p>

      {/* Current avg + projected after top sell */}
      <div className="flex items-center gap-3 mb-4 bg-slate-800/60 rounded-lg px-4 py-2.5">
        <div>
          <div className="text-xs text-slate-500">Tradable avg now</div>
          <div className="text-sm font-mono font-semibold text-slate-200">฿{fmt(currentAvg)}</div>
        </div>
        {topLot && topLot.avgAfterSell > 0 && (
          <>
            <div className="text-slate-600 text-sm">→</div>
            <div>
              <div className="text-xs text-slate-500">After selling Lot {topLot.lotNumber}</div>
              <div className="text-sm font-mono font-semibold text-green-400">
                ฿{fmt(topLot.avgAfterSell)}
                <span className="text-xs font-normal text-green-600 ml-1">
                  (↓฿{fmt(Math.abs(topLot.avgDrop))})
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ActionPlan fill recommendation */}
      {targetWeight !== null && recommended.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-900/20 border border-amber-700/40 px-4 py-3">
          <p className="text-xs text-amber-400 font-medium mb-1">
            Signal says sell {targetWeight}B — fill with:
          </p>
          <p className="text-sm text-white font-semibold">
            {recommended.map(a => `Lot ${a.lotNumber} (${a.lot.weight}B)`).join(' + ')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cash generated: ฿{fmt(recommended.reduce((s, a) => s + a.lot.weight * currentSellPrice, 0))} ·
            Profit locked: +฿{fmt(recommended.reduce((s, a) => s + a.totalProfit, 0))}
          </p>
        </div>
      )}

      {/* Lot list */}
      <div className="space-y-2">
        {analyses.map(a => {
          const isRecommended = recommendedIds.has(a.lot.id);

          const verdictStyle = {
            sell_first: { dot: 'bg-amber-400',  label: 'Sell first',  text: 'text-amber-400' },
            available:  { dot: 'bg-slate-500',   label: 'Available',   text: 'text-slate-500' },
            near_lock:  { dot: 'bg-purple-400',  label: 'Near lock — hold', text: 'text-purple-400' },
          }[a.verdict];

          return (
            <div
              key={a.lot.id}
              className={`rounded-lg px-4 py-3 border transition-colors ${
                isRecommended
                  ? 'bg-amber-900/15 border-amber-700/50'
                  : a.verdict === 'near_lock'
                  ? 'bg-purple-900/10 border-purple-800/30'
                  : 'bg-slate-800/40 border-slate-700/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Rank */}
                <div className="text-xs font-mono text-slate-600 w-4 pt-0.5 flex-shrink-0">
                  #{a.rank}
                </div>

                {/* Lot info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-200">
                      Lot {a.lotNumber}
                    </span>
                    <span className="text-xs text-slate-500">{a.lot.weight}B</span>
                    <span className="text-xs font-mono text-slate-400">
                      bought ฿{fmt(a.lot.buy_price)}
                    </span>
                    {isRecommended && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        recommended
                      </span>
                    )}
                  </div>

                  {/* Profit row */}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-green-400 font-mono">
                      +฿{fmt(a.profitPerBaht)}/baht
                    </span>
                    <span className="text-xs text-green-600">
                      +฿{fmt(a.totalProfit)} total
                    </span>
                    <span className="text-xs text-slate-600">
                      +{a.profitPct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Avg impact */}
                  {a.avgAfterSell > 0 && a.verdict !== 'near_lock' && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      Sell this → tradable avg{' '}
                      <span className="text-green-600 font-mono">
                        ฿{fmt(currentAvg)} → ฿{fmt(a.avgAfterSell)} (↓฿{fmt(Math.abs(a.avgDrop))})
                      </span>
                    </div>
                  )}
                  {a.verdict === 'near_lock' && (
                    <div className="text-xs text-purple-500 mt-0.5">
                      {a.profitPct.toFixed(1)}% P&L — approaching 40% auto-lock. Consider keeping.
                    </div>
                  )}
                </div>

                {/* Verdict */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${verdictStyle.dot}`} />
                  <span className={`text-xs font-medium ${verdictStyle.text}`}>
                    {verdictStyle.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-700 mt-4 pt-3 border-t border-slate-800">
        Selling highest-cost lots first lowers your tradable average on every cycle,
        widening your profit buffer without touching your best-performing positions.
      </p>
    </div>
  );
}
