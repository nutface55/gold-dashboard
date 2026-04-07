'use client';

import { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  currentSellPrice: number;
  sma: number;
  lowerBand: number;
}

type SellWeight = 5 | 10;

interface Tier {
  label: string;
  buyPrice: number;
  dropPct: number;      // % below sell price
  lotsBack: number;     // whole 5B lots you can buy back
  leftover: number;     // cash remaining after buying lots
  netGold: number;      // lotsBack - sellWeight (can be negative, 0, or positive)
}

function computeTiers(sellWeight: SellWeight, sellPrice: number, sma: number, lowerBand: number): Tier[] {
  const cash = sellWeight * sellPrice;

  // Price levels to evaluate — always unique and ≤ sell price
  const levels: { label: string; price: number }[] = [
    { label: 'Sell & immediately rebuy',  price: sellPrice },
    { label: '−3%  (minor dip)',          price: Math.round(sellPrice * 0.97) },
    { label: '−5%  pullback',             price: Math.round(sellPrice * 0.95) },
    { label: '20-day SMA',                price: sma },
    { label: '−10% correction',           price: Math.round(sellPrice * 0.90) },
    { label: '−15% correction',           price: Math.round(sellPrice * 0.85) },
    { label: 'Lower Bollinger Band',      price: lowerBand },
    { label: '−20% drawdown',             price: Math.round(sellPrice * 0.80) },
  ];

  // Deduplicate by price, keep only prices ≤ sell price
  const seen = new Set<number>();
  const unique = levels.filter(l => {
    if (l.price <= 0 || l.price > sellPrice || seen.has(l.price)) return false;
    seen.add(l.price);
    return true;
  });

  return unique.map(l => {
    // Max whole baht weight affordable at this price
    const maxBaht = Math.floor(cash / l.price);
    // Round DOWN to nearest 5B lot (minimum tradeable unit)
    const lotsBack = Math.floor(maxBaht / 5) * 5;
    const spentOnLots = lotsBack * l.price;
    const leftover = cash - spentOnLots;
    const dropPct = ((sellPrice - l.price) / sellPrice) * 100;

    return {
      label: l.label,
      buyPrice: l.price,
      dropPct,
      lotsBack,
      leftover,
      netGold: lotsBack - sellWeight,
    };
  });
}

// The exact price at which you gain the next 5B lot (netGold goes from 0 to +5)
function gainThreshold(sellWeight: SellWeight, sellPrice: number): number {
  const cash = sellWeight * sellPrice;
  const nextTarget = sellWeight + 5; // next achievable lot count (5B steps)
  // Largest price where nextTarget * price ≤ cash
  return Math.floor(cash / nextTarget);
}

// How many cycles of this leftover build to one 5B brick at buyPrice?
function cyclesForBrick(leftover: number, buyPrice: number): number | null {
  if (leftover <= 0 || buyPrice <= 0) return null;
  const brickCost = 5 * buyPrice;
  return Math.ceil(brickCost / leftover);
}

function fmt(n: number) { return n.toLocaleString(); }
function fmtPct(n: number) { return n.toFixed(1); }

export default function CyclePlanner({ currentSellPrice, sma, lowerBand }: Props) {
  const [sellWeight, setSellWeight] = useState<SellWeight>(10);
  const [rawPrice, setRawPrice] = useState('');

  const sellPrice = useMemo(() => {
    const parsed = parseInt(rawPrice.replace(/,/g, ''), 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : currentSellPrice;
  }, [rawPrice, currentSellPrice]);

  const cash = sellWeight * sellPrice;
  const tiers = useMemo(
    () => computeTiers(sellWeight, sellPrice, sma, lowerBand),
    [sellWeight, sellPrice, sma, lowerBand]
  );
  const threshold = gainThreshold(sellWeight, sellPrice);
  const thresholdDrop = ((sellPrice - threshold) / sellPrice) * 100;

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-amber-500 pl-2 mb-4">
          Cycle Planner
        </h3>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Sell amount */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">I want to sell</p>
            <div className="flex gap-1">
              {([5, 10] as SellWeight[]).map(w => (
                <button
                  key={w}
                  onClick={() => setSellWeight(w)}
                  className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                    sellWeight === w
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {w}B
                </button>
              ))}
            </div>
          </div>

          {/* Sell price */}
          <div className="flex-1 min-w-48">
            <p className="text-xs text-slate-500 mb-1.5">At sell price (฿/baht)</p>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder={currentSellPrice.toLocaleString()}
                value={rawPrice}
                onChange={e => setRawPrice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              />
              {rawPrice && (
                <button
                  onClick={() => setRawPrice('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cash summary */}
          <div className="bg-slate-800/60 rounded-lg px-4 py-2 border border-slate-700">
            <p className="text-xs text-slate-500">Cash generated</p>
            <p className="text-lg font-bold font-mono text-amber-400">฿{fmt(cash)}</p>
            <p className="text-xs text-slate-600">from selling {sellWeight}B @ ฿{fmt(sellPrice)}</p>
          </div>
        </div>
      </div>

      {/* Tier table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <p className="text-xs text-slate-500 mb-3">
          If gold drops to each level, here is what you get back.
          Lots are in 5B multiples — leftover cash rolls into your next purchase.
        </p>

        <div className="space-y-2">
          {tiers.map((t, i) => {
            const isGain    = t.netGold > 0;
            const isEven    = t.netGold === 0;
            const isLoss    = t.netGold < 0;
            const cycles    = cyclesForBrick(t.leftover, t.buyPrice);
            const leftoverPct = t.leftover > 0
              ? Math.round((t.leftover / (5 * t.buyPrice)) * 100)
              : 0;

            let rowBg = 'bg-slate-800/40 border-slate-700/30';
            if (isGain) rowBg = 'bg-green-900/30 border-green-700/40';

            return (
              <div key={i} className={`rounded-lg border px-4 py-3 ${rowBg}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Price + label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold text-slate-200">
                        ฿{fmt(t.buyPrice)}
                      </span>
                      {t.dropPct > 0 && (
                        <span className="text-xs text-slate-500">
                          (−{fmtPct(t.dropPct)}%)
                        </span>
                      )}
                      <span className="text-xs text-slate-600">{t.label}</span>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="flex items-center gap-4 text-right">
                    {/* Gold back */}
                    <div>
                      <div className={`text-sm font-mono font-semibold ${
                        isGain ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {t.lotsBack}B back
                      </div>
                      <div className="text-xs text-slate-600">
                        {isGain  ? `+${t.netGold}B net ✓` :
                         isEven  ? 'break even' :
                         `${t.netGold}B net`}
                      </div>
                    </div>

                    {/* Leftover */}
                    {t.leftover > 0 && (
                      <div className="border-l border-slate-700 pl-4">
                        <div className="text-sm font-mono text-slate-300">
                          +฿{fmt(t.leftover)}
                        </div>
                        <div className="text-xs text-slate-600">
                          {leftoverPct > 0 ? `${leftoverPct}% of next 5B` : 'leftover'}
                          {cycles && cycles <= 10 ? ` · ${cycles} cycles = +5B` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gain threshold callout */}
        <div className="mt-4 rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">
            To gain an extra 5B lot immediately (sell {sellWeight}B → get {sellWeight + 5}B back):
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold font-mono text-amber-400">
              ฿{fmt(threshold)}
            </span>
            <span className="text-sm text-slate-400">
              or lower — a {fmtPct(thresholdDrop)}% drop from here
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Until then, leftover cash from each cycle accumulates toward the next brick.
          </p>
        </div>

        {/* Math verification */}
        <details className="mt-3">
          <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400">
            Verify the math
          </summary>
          <div className="mt-2 bg-slate-950 rounded p-3 text-xs font-mono text-slate-500 space-y-1">
            <p>Sell: {sellWeight}B × ฿{fmt(sellPrice)} = ฿{fmt(cash)}</p>
            {tiers.map((t, i) => (
              <div key={i} className="pt-1 border-t border-slate-800">
                <p className="text-slate-400">@ ฿{fmt(t.buyPrice)} (−{fmtPct(t.dropPct)}%):</p>
                <p>  ฿{fmt(cash)} ÷ ฿{fmt(t.buyPrice)} = {(cash / t.buyPrice).toFixed(3)} baht → round to {t.lotsBack}B</p>
                <p>  {t.lotsBack}B × ฿{fmt(t.buyPrice)} = ฿{fmt(t.lotsBack * t.buyPrice)} spent</p>
                <p>  ฿{fmt(cash)} − ฿{fmt(t.lotsBack * t.buyPrice)} = ฿{fmt(t.leftover)} leftover ✓</p>
              </div>
            ))}
            <div className="pt-1 border-t border-slate-800">
              <p className="text-slate-400">+5B threshold:</p>
              <p>  ฿{fmt(cash)} ÷ {sellWeight + 5}B = ฿{(cash / (sellWeight + 5)).toFixed(2)} → floor = ฿{fmt(threshold)}</p>
              <p>  Check: {sellWeight + 5}B × ฿{fmt(threshold)} = ฿{fmt((sellWeight + 5) * threshold)} ≤ ฿{fmt(cash)} ✓</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
