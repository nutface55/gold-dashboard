'use client';

import { PortfolioMetrics as MetricsType } from '@/lib/trading-rules';
import { TrendingUp, TrendingDown, Target, Coins, Sparkles, Landmark, Trophy } from 'lucide-react';

interface Props {
  metrics: MetricsType | null;
  loading?: boolean;
}

export default function PortfolioMetrics({ metrics, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="h-3 bg-slate-700 rounded w-20 mb-2" />
              <div className="h-6 bg-slate-700 rounded w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const pnlPositive = metrics.pnlAmount >= 0;

  return (
    <div className="space-y-3">
      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Total Gold"
          icon={<Coins className="w-4 h-4 text-yellow-400" />}
          value={`${metrics.totalWeight} baht`}
          sub={`${metrics.foreverWeight}B forever locked`}
          valueColor="text-yellow-300"
          tooltip="Total weight of gold you own. Forever locked = lots up 40%+ that we never sell."
        />
        <MetricCard
          label="Avg Buy Price"
          icon={<Target className="w-4 h-4 text-blue-400" />}
          value={`฿${metrics.avgBuyPrice.toLocaleString()}`}
          sub="per baht weight"
          tooltip="Your average cost per baht of gold across all lots. The lower this is, the better."
        />
        <MetricCard
          label="Portfolio P&L"
          icon={pnlPositive
            ? <TrendingUp className="w-4 h-4 text-green-400" />
            : <TrendingDown className="w-4 h-4 text-red-400" />
          }
          value={`${pnlPositive ? '+' : ''}฿${metrics.pnlAmount.toLocaleString()}`}
          sub={`${pnlPositive ? '+' : ''}${metrics.pnlPercent.toFixed(1)}% total return`}
          valueColor={pnlPositive ? 'text-green-400' : 'text-red-400'}
          tooltip="Profit & Loss — how much you've made (or lost) on paper vs. what you paid. Not real until you sell."
        />
        <MetricCard
          label="Current Value"
          icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
          value={`฿${metrics.currentValue.toLocaleString()}`}
          sub={`Invested ฿${metrics.totalInvested.toLocaleString()}`}
          valueColor="text-yellow-300"
          tooltip="What your gold is worth today at the current sell price."
        />
      </div>

      {/* Row 2: Strategic metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          label="Profit per Baht"
          icon={<Sparkles className="w-4 h-4 text-emerald-400" />}
          value={`${metrics.unrealisedProfitPerBaht >= 0 ? '+' : ''}฿${metrics.unrealisedProfitPerBaht.toLocaleString()}`}
          sub="per baht weight held"
          valueColor={metrics.unrealisedProfitPerBaht >= 0 ? 'text-emerald-400' : 'text-red-400'}
          tooltip="For every 1 baht of gold you own, this is how much profit you're sitting on right now. Multiply by your total gold to get your full unrealised gain. It goes up when gold rises, down when it falls."
        />
        <MetricCard
          label="Cost to Reach 150B"
          icon={<Landmark className="w-4 h-4 text-cyan-400" />}
          value={`฿${metrics.costToTarget.toLocaleString()}`}
          sub={`Need ${metrics.bricksToTarget} more baht of gold`}
          tooltip="How much cash you'd need to inject today (at current price) to buy enough gold to hit your 150 baht target."
        />
        <MetricCard
          label="Target Progress"
          icon={<Trophy className="w-4 h-4 text-yellow-400" />}
          value={`${metrics.totalWeight} / 150B`}
          sub={`${metrics.bricksToTarget}B still to go`}
          tooltip="How far along you are toward your 150 baht accumulation goal."
        />
      </div>

      {/* Progress bar */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold text-slate-200 border-l-2 border-yellow-500 pl-2">Progress to 150B target</span>
          <span className="text-sm font-bold text-yellow-400">{metrics.progressTo150}%</span>
        </div>
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(metrics.progressTo150, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>0B</span>
          <span>75B (halfway)</span>
          <span>150B</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, sub, icon, valueColor = 'text-white', tooltip,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ReactNode; valueColor?: string; tooltip?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 group relative">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      {/* Tooltip on hover */}
      {tooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-slate-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
          {tooltip}
        </div>
      )}
    </div>
  );
}
