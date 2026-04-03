'use client';

import { calculateScenarios, BuybackScenario } from '@/lib/brick-calculator';
import { Trophy, TrendingUp } from 'lucide-react';

interface Props {
  currentPrice: number;
  sma: number;
  lowerBand: number;
  cashInHand?: number;
}

export default function ScenarioGrid({ currentPrice, sma, lowerBand, cashInHand }: Props) {
  const scenarios = calculateScenarios(currentPrice, sma, lowerBand).slice(0, 8);

  if (scenarios.length === 0) return null;

  const bestViable = scenarios.find(s => s.isViable);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Scenario Comparison</h3>
        <p className="text-xs text-zinc-600 mt-1">Sell → Buy-back scenarios ranked by net gold gain</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-800">
              <th className="text-left px-4 py-3">Scenario</th>
              <th className="text-right px-4 py-3">Cash</th>
              <th className="text-right px-4 py-3">Buy-back</th>
              <th className="text-right px-4 py-3">Leftover</th>
              <th className="text-right px-4 py-3">Net Gold</th>
              <th className="text-right px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => {
              const isBest = s === bestViable;
              return (
                <tr key={i}
                  className={`border-b border-zinc-800 ${isBest ? 'bg-green-900/15' : ''} hover:bg-zinc-800/30 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isBest && <Trophy className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                      <span className="text-zinc-300 text-xs">{s.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    ฿{s.cashFromSale.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white font-medium">{s.buybackWeight}B</span>
                    <span className="text-xs text-zinc-500 ml-1">
                      ({s.buybackBricks.map(b => `${b}B`).join('+')})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">
                    ฿{s.leftoverCash.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${s.netGoldGain > 0 ? 'text-green-400' : s.netGoldGain === 0 ? 'text-zinc-400' : 'text-red-400'}`}>
                      {s.netGoldGain > 0 ? '+' : ''}{s.netGoldGain}B
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.isViable ? (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
                        <TrendingUp className="inline w-3 h-3 mr-1" />Viable
                      </span>
                    ) : (
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">No gain</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
