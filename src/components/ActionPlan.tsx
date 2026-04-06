'use client';

import { ActionPlan as ActionPlanType } from '@/lib/trading-rules';
import { AlertTriangle, TrendingDown, TrendingUp, Minus, DollarSign, Clock, ArrowRight } from 'lucide-react';

interface Props {
  plan: ActionPlanType | null;
  loading?: boolean;
  lastUpdated?: Date | null;
  priceUpdateTime?: string | null;  // e.g. "09:38 (5th update today)"
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
    bg: 'bg-slate-900 border-slate-600',
    badge: 'bg-slate-600 text-white',
    icon: Minus,
    label: 'HOLD',
    iconColor: 'text-slate-400',
  },
  buy_back: {
    bg: 'bg-blue-950 border-blue-500',
    badge: 'bg-blue-500 text-white',
    icon: DollarSign,
    label: 'BUY BACK',
    iconColor: 'text-blue-400',
  },
  strong_buy: {
    bg: 'bg-green-950 border-green-500',
    badge: 'bg-green-500 text-white',
    icon: TrendingUp,
    label: 'STRONG BUY',
    iconColor: 'text-green-400',
  },
  mild_buy: {
    bg: 'bg-teal-950 border-teal-500',
    badge: 'bg-teal-500 text-white',
    icon: TrendingUp,
    label: 'MILD BUY',
    iconColor: 'text-teal-400',
  },
  cash_injection: {
    bg: 'bg-green-950 border-green-500',
    badge: 'bg-green-500 text-white',
    icon: TrendingUp,
    label: 'BUY MORE',
    iconColor: 'text-green-400',
  },
};

export default function ActionPlan({ plan, loading, lastUpdated, priceUpdateTime }: Props) {
  if (loading) {
    return (
      <div className="border border-slate-700 rounded-lg p-6 bg-slate-900 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-24 mb-3" />
        <div className="h-7 bg-slate-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-slate-700 rounded w-full" />
      </div>
    );
  }

  if (!plan) return null;

  const cfg = signalConfig[plan.signal];
  const Icon = cfg.icon;

  return (
    <div className={`border-2 rounded-lg p-6 ${cfg.bg}`}>
      {/* Header label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Trading Pool</span>
        <span className="text-xs text-slate-600 italic">Existing lots → cycle for profit</span>
      </div>
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

      <h2 className="text-2xl font-bold text-white mb-3 leading-snug">{plan.headline}</h2>
      <p className="text-sm text-slate-300 mb-4 whitespace-pre-line leading-relaxed">{plan.detail}</p>

      {/* Sell → Rebuy preview — shown on all sell signals */}
      {plan.rebuySummary && (
        <div className="bg-black/40 rounded-lg p-4 mt-3 border border-yellow-800">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Sell → Rebuy Preview</span>
          </div>
          <pre className="text-xs text-yellow-200 font-mono whitespace-pre-wrap leading-relaxed">
            {plan.rebuySummary}
          </pre>
        </div>
      )}

      {/* Math verification */}
      {plan.mathVerification && (
        <div className="bg-black/40 rounded-lg p-4 mt-3 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Math Verification</span>
          </div>
          <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed">
            {plan.mathVerification}
          </pre>
        </div>
      )}

      {plan.daysSinceSale !== undefined && plan.daysSinceSale > 0 && (
        <div className={`mt-3 text-xs ${plan.daysSinceSale >= 25 ? 'text-yellow-400' : 'text-slate-400'}`}>
          Day {plan.daysSinceSale} of 30-day redeployment window
        </div>
      )}

      {/* Timestamp footer */}
      {(lastUpdated || priceUpdateTime) && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 flex-wrap">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-xs text-slate-500">
            {lastUpdated && (
              <>
                Recommendation calculated{' '}
                <span className="text-slate-400 font-medium">
                  {lastUpdated.toLocaleTimeString('th-TH', {
                    timeZone: 'Asia/Bangkok',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })} ICT
                </span>
              </>
            )}
            {priceUpdateTime && (
              <span className="text-slate-600">
                {lastUpdated ? ' · ' : ''}Price source: <span className="text-slate-500">{priceUpdateTime}</span>
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
