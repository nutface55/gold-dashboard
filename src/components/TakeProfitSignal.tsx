'use client';

import { TrendingUp } from 'lucide-react';
import { Lot, isLockedLot } from '@/lib/trading-rules';
import { BandPosition } from '@/lib/band-calculator';

interface MarketSnapshot {
  goldChange7d: number | null;
  gold52wHigh: number | null;
  gold52wLow: number | null;
  usdSpot: number | null;
}

interface Props {
  lots: Lot[];
  currentSellPrice: number;
  bandPosition: BandPosition | null;
  market: MarketSnapshot | null;
}

interface Signal {
  lot: Lot;
  lotIndex: number;
  profitPerBaht: number;
  totalProfit: number;
  profitPct: number;
  condUpperBand: boolean;
  cond52w: boolean;
  condMomentum: boolean;
}

function getSignal(
  lots: Lot[],
  currentSellPrice: number,
  bandPosition: BandPosition | null,
  market: MarketSnapshot | null
): Signal | null {
  if (!currentSellPrice || !bandPosition) return null;

  const condUpperBand =
    bandPosition.zone === 'strong_sell' || bandPosition.zone === 'mild_sell';

  const pos52w =
    market?.usdSpot && market.gold52wHigh && market.gold52wLow && market.gold52wHigh > market.gold52wLow
      ? (market.usdSpot - market.gold52wLow) / (market.gold52wHigh - market.gold52wLow)
      : null;
  const cond52w = pos52w !== null ? pos52w >= 0.80 : false;

  const condMomentum = (market?.goldChange7d ?? 0) >= 2;

  const metCount = [condUpperBand, cond52w, condMomentum].filter(Boolean).length;
  if (metCount < 2) return null;

  // Only consider tradable (non-locked) lots with meaningful profit (≥ ฿2,000/baht)
  const tradable = lots
    .map((l, i) => ({ lot: l, index: i }))
    .filter(({ lot }) => !isLockedLot(lot, currentSellPrice))
    .filter(({ lot }) => currentSellPrice - lot.buy_price >= 2000);

  if (tradable.length === 0) return null;

  // Pick the most profitable lot (lowest buy price = most profit locked in)
  tradable.sort((a, b) => a.lot.buy_price - b.lot.buy_price);
  const { lot, index } = tradable[0];

  const profitPerBaht = currentSellPrice - lot.buy_price;
  const totalProfit = profitPerBaht * lot.weight;
  const profitPct = (profitPerBaht / lot.buy_price) * 100;

  return {
    lot,
    lotIndex: index + 1,
    profitPerBaht,
    totalProfit,
    profitPct,
    condUpperBand,
    cond52w,
    condMomentum,
  };
}

export default function TakeProfitSignal({ lots, currentSellPrice, bandPosition, market }: Props) {
  const signal = getSignal(lots, currentSellPrice, bandPosition, market);
  if (!signal) return null;

  const conditions = [
    { label: 'Band zone', met: signal.condUpperBand, detail: 'Price above SMA — extended' },
    { label: '52-week high', met: signal.cond52w, detail: '≥80% of yearly range' },
    { label: '7-day run', met: signal.condMomentum, detail: `+${(market?.goldChange7d ?? 0).toFixed(1)}% this week` },
  ];

  return (
    <div className="bg-slate-900 border border-amber-700/60 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-amber-300">Consider Taking Profit</h3>
      </div>

      <p className="text-sm text-slate-300 mb-4">
        Price is running high. Consider selling{' '}
        <span className="text-white font-semibold">Lot {signal.lotIndex} ({signal.lot.weight}B)</span>
        {' '}bought at{' '}
        <span className="font-mono text-slate-200">฿{signal.lot.buy_price.toLocaleString()}</span>
        {' '}to lock in{' '}
        <span className="text-green-400 font-semibold font-mono">
          +฿{signal.totalProfit.toLocaleString()}
        </span>
        {' '}(฿{signal.profitPerBaht.toLocaleString()}/baht · +{signal.profitPct.toFixed(1)}%).
        Redeploy the cash when price drops back to the mid-band.
      </p>

      <div className="flex gap-2 flex-wrap">
        {conditions.map(c => (
          <div
            key={c.label}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              c.met
                ? 'bg-amber-900/30 border-amber-700/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-600'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${c.met ? 'bg-amber-400' : 'bg-slate-600'}`} />
            {c.label}: {c.detail}
          </div>
        ))}
      </div>
    </div>
  );
}
