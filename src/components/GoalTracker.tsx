'use client';

import { TrendingUp, TrendingDown, Minus, PiggyBank } from 'lucide-react';
import { BandPosition } from '@/lib/band-calculator';
import { PortfolioMetrics } from '@/lib/trading-rules';

interface Props {
  bandPosition: BandPosition | null;
  metrics: PortfolioMetrics | null;
  loading?: boolean;
}

type GoalSignal = 'add_now' | 'decent_entry' | 'hold_capital' | 'wait';

interface GoalPlan {
  signal: GoalSignal;
  headline: string;
  detail: string;
}

function getGoalPlan(bandPosition: BandPosition, metrics: PortfolioMetrics): GoalPlan {
  const { zone, percentAboveSma, sma, upperBand, lowerBand, currentPrice } = bandPosition;
  const { avgBuyPrice, totalWeight } = metrics;

  const belowOwnAvg = currentPrice < avgBuyPrice;

  if (zone === 'strong_buy' || zone === 'hold_buy' || belowOwnAvg) {
    return {
      signal: 'add_now',
      headline: belowOwnAvg
        ? 'Good time to add — price is below your overall average'
        : 'Good time to add — price is near its recent low',
      detail: belowOwnAvg
        ? `Adding fresh capital now (฿${currentPrice.toLocaleString()}/baht) would bring your overall average cost down. Every baht added here works harder toward 150B.`
        : `Price is near the lower Bollinger Band (฿${lowerBand.toLocaleString()}). Deploying new money here adds to your 150B stack at a historically good entry.`,
    };
  }

  if (percentAboveSma <= 0) {
    return {
      signal: 'decent_entry',
      headline: 'Decent entry — price is near its average',
      detail: `Price is close to the 20-day average (฿${sma.toLocaleString()}). Not a screaming deal, but reasonable to add if you have capital earmarked for the 150B goal. You're ${150 - totalWeight}B away.`,
    };
  }

  if (zone === 'mild_sell') {
    return {
      signal: 'hold_capital',
      headline: 'Hold new capital — wait for a better entry',
      detail: `Price is ${percentAboveSma.toFixed(1)}% above its 20-day average (฿${sma.toLocaleString()}). Deploying fresh money here would raise your overall average cost. Sit on the cash and wait for price to come back down.`,
    };
  }

  // strong_sell zone
  return {
    signal: 'wait',
    headline: 'Do not deploy new capital right now',
    detail: `Price is above the upper Bollinger Band (฿${upperBand.toLocaleString()}) — an extended high. Adding now would significantly raise your average cost across all ${totalWeight}B. Wait for a meaningful pullback.`,
  };
}

const config: Record<GoalSignal, {
  bg: string;
  badge: string;
  label: string;
  Icon: React.ElementType;
  iconColor: string;
}> = {
  add_now: {
    bg: 'bg-green-950/60 border-green-700',
    badge: 'bg-green-600 text-white',
    label: 'ADD',
    Icon: TrendingUp,
    iconColor: 'text-green-400',
  },
  decent_entry: {
    bg: 'bg-teal-950/60 border-teal-700',
    badge: 'bg-teal-600 text-white',
    label: 'DECENT ENTRY',
    Icon: TrendingUp,
    iconColor: 'text-teal-400',
  },
  hold_capital: {
    bg: 'bg-slate-900 border-slate-600',
    badge: 'bg-slate-600 text-white',
    label: 'HOLD CAPITAL',
    Icon: Minus,
    iconColor: 'text-slate-400',
  },
  wait: {
    bg: 'bg-orange-950/60 border-orange-700',
    badge: 'bg-orange-600 text-white',
    label: 'WAIT',
    Icon: TrendingDown,
    iconColor: 'text-orange-400',
  },
};

export default function GoalTracker({ bandPosition, metrics, loading }: Props) {
  if (loading) {
    return (
      <div className="border border-slate-700 rounded-lg p-5 bg-slate-900 animate-pulse">
        <div className="h-3 bg-slate-700 rounded w-40 mb-4" />
        <div className="h-5 bg-slate-700 rounded w-2/3 mb-2" />
        <div className="h-3 bg-slate-700 rounded w-full" />
      </div>
    );
  }

  if (!bandPosition || !metrics) return null;

  const plan = getGoalPlan(bandPosition, metrics);
  const cfg = config[plan.signal];
  const Icon = cfg.Icon;

  const overallPnlPct = metrics.pnlPercent;

  return (
    <div className={`border rounded-lg p-5 ${cfg.bg}`}>
      {/* Header label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Goal Tracker</span>
        </div>
        <span className="text-xs text-slate-600 italic">Fresh capital → long-term 150B stack</span>
      </div>

      {/* Signal */}
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wide ${cfg.badge}`}>{cfg.label}</span>
      </div>

      <p className="text-base font-semibold text-white mb-1">{plan.headline}</p>
      <p className="text-sm text-slate-400 leading-relaxed mb-4">{plan.detail}</p>

      {/* Stats strip — no progress bar (duplicates PortfolioMetrics) */}
      <div className="border-t border-white/10 pt-3 flex items-center gap-4">
        <span className="text-xs text-slate-500">
          {metrics.totalWeight}B of 150B · {150 - metrics.totalWeight}B to go
        </span>
        <span className="text-xs text-slate-500 font-mono">
          avg ฿{metrics.avgBuyPrice.toLocaleString()}
        </span>
        <span className={`text-xs font-mono font-medium ml-auto ${overallPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {overallPnlPct >= 0 ? '+' : ''}{overallPnlPct.toFixed(1)}% P&L
        </span>
      </div>
    </div>
  );
}
