'use client';

import { BandPosition as BandPositionType } from '@/lib/band-calculator';

interface Props {
  bandPosition: BandPositionType | null;
  loading?: boolean;
}

export default function BandPosition({ bandPosition, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-zinc-700 rounded w-32 mb-4" />
        <div className="h-6 bg-zinc-700 rounded mb-2" />
      </div>
    );
  }

  if (!bandPosition) return null;

  const { sma, upperBand, lowerBand, currentPrice, positionRatio, zone, percentAboveSma, percentToUpperBand, percentToLowerBand } = bandPosition;

  // Clamp position for display
  const clampedRatio = Math.max(0.02, Math.min(0.98, positionRatio));

  const zoneColors: Record<string, string> = {
    strong_sell: 'text-red-400',
    mild_sell: 'text-orange-400',
    hold: 'text-zinc-300',
    hold_buy: 'text-teal-400',
    strong_buy: 'text-green-400',
  };

  const zoneLabels: Record<string, string> = {
    strong_sell: 'ABOVE UPPER BAND — Strong Sell Zone',
    mild_sell: 'ABOVE SMA — Mild Sell Zone',
    hold: 'NEAR SMA — Hold',
    hold_buy: 'BELOW SMA — Consider Buying',
    strong_buy: 'NEAR LOWER BAND — Strong Buy Zone',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Band Position</h3>
        <span className={`text-xs font-bold ${zoneColors[zone]}`}>{zoneLabels[zone]}</span>
      </div>

      {/* Band bar */}
      <div className="relative mb-6">
        {/* Background gradient */}
        <div className="h-8 rounded-lg overflow-hidden flex">
          <div className="flex-1 bg-green-900/60" title="Buy zone" />
          <div className="w-px bg-green-500" />
          <div className="flex-[2] bg-zinc-700/60" title="Hold zone" />
          <div className="w-px bg-zinc-400" />
          <div className="flex-1 bg-orange-900/60" title="Mild sell" />
          <div className="w-px bg-red-500" />
          <div className="flex-[0.5] bg-red-900/60" title="Strong sell" />
        </div>

        {/* Price marker */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: `${clampedRatio * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-1 h-10 bg-white rounded-full shadow-lg" />
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-1 text-xs text-zinc-500">
          <span>Lower ฿{lowerBand.toLocaleString()}</span>
          <span>SMA ฿{sma.toLocaleString()}</span>
          <span>Upper ฿{upperBand.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1">vs SMA</div>
          <div className={`text-base font-bold ${percentAboveSma >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {percentAboveSma >= 0 ? '+' : ''}{percentAboveSma.toFixed(1)}%
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1">Current Price</div>
          <div className="text-base font-bold text-white">฿{currentPrice.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1">To Upper Band</div>
          <div className={`text-base font-bold ${percentToUpperBand < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
            {percentToUpperBand >= 0 ? '+' : ''}{percentToUpperBand.toFixed(1)}%
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Price is {Math.abs(percentAboveSma).toFixed(1)}% {percentAboveSma >= 0 ? 'above' : 'below'} SMA
        {' '}and {Math.abs(percentToLowerBand).toFixed(1)}% above lower band.
        {' '}Bollinger Bands: 20-day SMA ± 2σ.
      </p>
    </div>
  );
}
