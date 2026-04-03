'use client';

import { ActionPlan as ActionPlanType } from '@/lib/trading-rules';
import { AlertTriangle, TrendingDown, TrendingUp, Minus, DollarSign, Clock } from 'lucide-react';

interface Props {
  plan: ActionPlanType | null;
  loading?: boolean;
}

const signalConfig = {
  strong_sell: {
    bg: 'bg-red-950 border-red-500',
    badge: 'bg-red-500 text-white',
    icon: TrendingDown,
    label: 'STRONG SELL',
    iconColor: 'text-red-400',
  },
  mild_sell: {
    bg: 'bg-orange-950 border-orange-500',
    badge: 'bg-orange-500 text-white',
    icon: TrendingDown,
    label: 'MILD SELL',
    iconColor: 'text-orange-400',
  },
  hold: {
    bg: 'bg-zinc-900 border-zinc-600',
    badge: 'bg-zinc-600 text-white',
    icon: Minus,
    label: 'HOLD',
    iconColor: 'text-zinc-400',
  },
  buy_back: {
    bg: 'bg-blue-950 border-blue-500',
    badge: 'bg-blue-500 text-white',
    icon: DollarSign,
    label: 'BUY BACK',
    iconColor: 'text-blue-400',
  },
  cash_injection: {
    bg: 'bg-green-950 border-green-500',
    badge: 'bg-green-500 text-white',
    icon: TrendingUp,
    label: 'BUY MORE',
    iconColor: 'text-green-400',
  },
  hold_buy: {
    bg: 'bg-teal-950 border-teal-500',
    badge: 'bg-teal-600 text-white',
    icon: TrendingUp,
    label: 'HOLD / BUY',
    iconColor: 'text-teal-400',
  },
};

export default function ActionPlan({ plan, loading }: Props) {
  if (loading) {
    return (
      <div className="border border-zinc-700 rounded-xl p-6 bg-zinc-900 animate-pulse">
        <div className="h-4 bg-zinc-700 rounded w-24 mb-3" />
        <div className="h-7 bg-zinc-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-zinc-700 rounded w-full" />
      </div>
    );
  }

  if (!plan) return null;

  const cfg = signalConfig[plan.signal];
  const Icon = cfg.icon;

  return (
    <div className={`border-2 rounded-xl p-5 ${cfg.bg}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`w-6 h-6 ${cfg.iconColor}`} />
        <span className={`text-xs font-bold px-2 py-1 rounded ${cfg.badge}`}>{cfg.label}</span>
        {plan.cashWarning && (
          <span className="flex items-center gap-1 text-xs text-yellow-400">
            <Clock className="w-3 h-3" />
            30-day clock running!
          </span>
        )}
      </div>

      <h2 className="text-xl font-bold text-white mb-2">{plan.headline}</h2>
      <p className="text-sm text-zinc-300 mb-4">{plan.detail}</p>

      {plan.mathVerification && (
        <div className="bg-black/40 rounded-lg p-4 mt-3 border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Math Verification</span>
          </div>
          <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed">
            {plan.mathVerification}
          </pre>
        </div>
      )}

      {plan.injectionImpact && (
        <div className="bg-black/40 rounded-lg p-4 mt-3 border border-green-800">
          <p className="text-xs text-green-400 font-semibold mb-1">If you add a 5B brick now:</p>
          <p className="text-sm text-white">
            Avg drops from ฿{plan.injectionImpact.newAvgBuyPrice.toLocaleString()}
            {' '}(saves ฿{plan.injectionImpact.avgDrop.toLocaleString()}/baht)
          </p>
        </div>
      )}

      {plan.daysSinceSale !== undefined && plan.daysSinceSale > 0 && (
        <div className={`mt-3 text-xs ${plan.daysSinceSale >= 25 ? 'text-yellow-400' : 'text-zinc-400'}`}>
          Day {plan.daysSinceSale} of 30-day redeployment window
        </div>
      )}
    </div>
  );
}
