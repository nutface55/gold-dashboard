'use client';

import { PortfolioMetrics as MetricsType } from '@/lib/trading-rules';
import { TrendingUp, TrendingDown, Target, Coins } from 'lucide-react';

interface Props {
  metrics: MetricsType | null;
  loading?: boolean;
}

export default function PortfolioMetrics({ metrics, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <div className="h-3 bg-zinc-700 rounded w-20 mb-2" />
            <div className="h-6 bg-zinc-700 rounded w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const pnlPositive = metrics.pnlAmount >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Total Gold"
          value={`${metrics.totalWeight} baht`}
          sub={`${metrics.foreverWeight}B forever locked`}
          icon={<Coins className="w-4 h-4 text-yellow-400" />}
        />
        <MetricCard
          label="Avg Buy Price"
          value={`฿${metrics.avgBuyPrice.toLocaleString()}`}
          sub="per baht"
          icon={<Target className="w-4 h-4 text-blue-400" />}
        />
        <MetricCard
          label="Portfolio P&L"
          value={`${pnlPositive ? '+' : ''}฿${metrics.pnlAmount.toLocaleString()}`}
          sub={`${pnlPositive ? '+' : ''}${metrics.pnlPercent.toFixed(1)}%`}
          icon={pnlPositive
            ? <TrendingUp className="w-4 h-4 text-green-400" />
            : <TrendingDown className="w-4 h-4 text-red-400" />
          }
          valueColor={pnlPositive ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          label="Current Value"
          value={`฿${metrics.currentValue.toLocaleString()}`}
          sub={`Invested ฿${metrics.totalInvested.toLocaleString()}`}
          icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
        />
      </div>

      {/* Progress bar to 150 baht */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold text-zinc-300">Progress to 150 baht target</span>
          <span className="text-sm font-bold text-yellow-400">{metrics.totalWeight} / 150 baht ({metrics.progressTo150}%)</span>
        </div>
        <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(metrics.progressTo150, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-zinc-500">
          <span>0 baht</span>
          <span>75 baht (halfway)</span>
          <span>150 baht</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  valueColor = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-bold ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}
