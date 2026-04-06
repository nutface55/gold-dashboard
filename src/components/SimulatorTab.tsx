'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Lot, isLockedLot, PortfolioMetrics } from '@/lib/trading-rules';
import { BandData } from '@/lib/band-calculator';

interface Props {
  lots: Lot[];
  currentSellPrice: number;
  currentBuyPrice: number;
  metrics: PortfolioMetrics;
  bands: BandData | null;
}

function simulateBuy(
  weight: number,
  buyPrice: number,
  metrics: PortfolioMetrics
) {
  const newTradableWeight = metrics.tradableWeight + weight;
  const newTradableInvested = metrics.tradableWeight * metrics.tradableAvgBuyPrice + weight * buyPrice;
  const newTradableAvg = Math.round(newTradableInvested / newTradableWeight);
  const avgChange = newTradableAvg - metrics.tradableAvgBuyPrice;
  const newTotalWeight = metrics.totalWeight + weight;
  const cost = weight * buyPrice;
  const newPnlPct = ((buyPrice - newTradableAvg) / newTradableAvg) * 100;

  return { newTradableAvg, avgChange, newTotalWeight, cost, newPnlPct };
}

function simulateSell(
  weight: number,
  sellPrice: number,
  lots: Lot[],
  metrics: PortfolioMetrics,
  bands: BandData | null
) {
  const cash = weight * sellPrice;
  const newTotalWeight = metrics.totalWeight - weight;

  // Rebuy scenarios
  const rebuyAtSma = bands ? Math.floor(cash / bands.sma / 5) * 5 : null;
  const rebuyAtLower = bands ? Math.floor(cash / bands.lowerBand / 5) * 5 : null;
  const netAtSma = rebuyAtSma !== null ? rebuyAtSma - weight : null;
  const netAtLower = rebuyAtLower !== null ? rebuyAtLower - weight : null;

  // Find which lots would be sold (most profitable tradable, highest profit first)
  const tradable = lots
    .filter(l => !isLockedLot(l, sellPrice))
    .sort((a, b) => a.buy_price - b.buy_price); // lowest cost = most profit

  let remaining = weight;
  const soldLots: { weight: number; buy_price: number }[] = [];
  for (const lot of tradable) {
    if (remaining <= 0) break;
    const take = Math.min(lot.weight, remaining);
    soldLots.push({ weight: take, buy_price: lot.buy_price });
    remaining -= take;
  }

  const avgSoldCost = soldLots.length > 0
    ? Math.round(soldLots.reduce((s, l) => s + l.weight * l.buy_price, 0) / weight)
    : 0;
  const profitLocked = soldLots.length > 0 ? (sellPrice - avgSoldCost) * weight : 0;

  return { cash, newTotalWeight, rebuyAtSma, rebuyAtLower, netAtSma, netAtLower, avgSoldCost, profitLocked };
}

interface BuyCardProps {
  weight: number;
  buyPrice: number;
  metrics: PortfolioMetrics;
}

function BuyCard({ weight, buyPrice, metrics }: BuyCardProps) {
  if (!buyPrice) return null;
  const sim = simulateBuy(weight, buyPrice, metrics);
  const avgDown = sim.avgChange < 0;
  const avgUp = sim.avgChange > 0;

  return (
    <div className="bg-slate-900 border border-green-800/50 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-green-400" />
        <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Buy {weight}B</span>
        <span className="ml-auto text-xs text-slate-500 font-mono">฿{buyPrice.toLocaleString()}/baht</span>
      </div>

      <div className="space-y-3">
        <Row label="Cost" value={`฿${sim.cost.toLocaleString()}`} mono />

        <Row
          label="Trading pool avg"
          value={`฿${sim.newTradableAvg.toLocaleString()}`}
          sub={
            sim.avgChange === 0 ? 'no change' :
            avgDown
              ? `↓฿${Math.abs(sim.avgChange).toLocaleString()} cheaper`
              : `↑฿${sim.avgChange.toLocaleString()} more expensive`
          }
          subColor={avgDown ? 'text-green-400' : avgUp ? 'text-red-400' : 'text-slate-500'}
          mono
        />

        <Row
          label="Total gold"
          value={`${sim.newTotalWeight}B`}
          sub={`was ${metrics.totalWeight}B → +${weight}B`}
          subColor="text-slate-500"
        />

        <Row
          label="Trading pool P&L"
          value={`${sim.newPnlPct >= 0 ? '+' : ''}${sim.newPnlPct.toFixed(1)}%`}
          valueColor={sim.newPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}
          sub={`was ${metrics.tradablePnlPercent >= 0 ? '+' : ''}${metrics.tradablePnlPercent.toFixed(1)}%`}
          subColor="text-slate-500"
        />

        <Row label="Progress to 150B" value={`${sim.newTotalWeight} / 150B`} mono />
      </div>
    </div>
  );
}

interface SellCardProps {
  weight: number;
  sellPrice: number;
  lots: Lot[];
  metrics: PortfolioMetrics;
  bands: BandData | null;
}

function SellCard({ weight, sellPrice, lots, metrics, bands }: SellCardProps) {
  if (!sellPrice) return null;
  const tradableWeight = metrics.tradableWeight;
  if (tradableWeight < weight) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sell {weight}B</span>
        </div>
        <p className="text-xs text-slate-600">Not enough tradable gold — only {tradableWeight}B available.</p>
      </div>
    );
  }

  const sim = simulateSell(weight, sellPrice, lots, metrics, bands);

  return (
    <div className="bg-slate-900 border border-orange-800/50 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="w-4 h-4 text-orange-400" />
        <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Sell {weight}B</span>
        <span className="ml-auto text-xs text-slate-500 font-mono">฿{sellPrice.toLocaleString()}/baht</span>
      </div>

      <div className="space-y-3">
        <Row label="Cash received" value={`฿${sim.cash.toLocaleString()}`} mono valueColor="text-green-400" />
        <Row
          label="Profit locked in"
          value={`+฿${Math.round(sim.profitLocked).toLocaleString()}`}
          sub={`bought avg ฿${sim.avgSoldCost.toLocaleString()}`}
          subColor="text-slate-500"
          valueColor="text-green-400"
          mono
        />
        <Row
          label="Remaining gold"
          value={`${sim.newTotalWeight}B`}
          sub={`was ${metrics.totalWeight}B → -${weight}B`}
          subColor="text-slate-500"
        />

        {/* Rebuy scenarios */}
        {bands && (
          <div className="border-t border-slate-800 pt-3 mt-1 space-y-2">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">If you rebuy later</p>
            {sim.rebuyAtSma !== null && (
              <Row
                label={`At SMA ฿${bands.sma.toLocaleString()}`}
                value={`${sim.rebuyAtSma}B back`}
                sub={sim.netAtSma !== null ? `${sim.netAtSma >= 0 ? '+' : ''}${sim.netAtSma}B net` : ''}
                subColor={sim.netAtSma !== null && sim.netAtSma >= 0 ? 'text-green-400' : 'text-red-400'}
                mono
              />
            )}
            {sim.rebuyAtLower !== null && (
              <Row
                label={`At lower band ฿${bands.lowerBand.toLocaleString()}`}
                value={`${sim.rebuyAtLower}B back`}
                sub={sim.netAtLower !== null ? `${sim.netAtLower >= 0 ? '+' : ''}${sim.netAtLower}B net` : ''}
                subColor={sim.netAtLower !== null && sim.netAtLower >= 0 ? 'text-green-400' : 'text-red-400'}
                mono
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, sub, valueColor, subColor, mono
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  subColor?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-slate-500 pt-0.5">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''} ${valueColor || 'text-white'}`}>
          {value}
        </span>
        {sub && <div className={`text-xs ${subColor || 'text-slate-500'}`}>{sub}</div>}
      </div>
    </div>
  );
}

export default function SimulatorTab({ lots, currentSellPrice, currentBuyPrice, metrics, bands }: Props) {
  const price = currentSellPrice || currentBuyPrice;

  if (!price) {
    return (
      <div className="text-center py-12 text-slate-600 text-sm">
        Live price unavailable — simulator needs a current price.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Quick Simulator</h2>
        <p className="text-xs text-slate-500">
          See what happens to your portfolio if you buy or sell right now at ฿{price.toLocaleString()}.
          Numbers are instant — no changes are saved.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BuyCard weight={5} buyPrice={currentBuyPrice || price} metrics={metrics} />
        <BuyCard weight={10} buyPrice={currentBuyPrice || price} metrics={metrics} />
        <SellCard weight={5} sellPrice={currentSellPrice || price} lots={lots} metrics={metrics} bands={bands} />
        <SellCard weight={10} sellPrice={currentSellPrice || price} lots={lots} metrics={metrics} bands={bands} />
      </div>
    </div>
  );
}
