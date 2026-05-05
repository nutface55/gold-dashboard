'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { Lot } from '@/lib/trading-rules';

interface PricePoint { date: string; price: number }

interface Props {
  priceHistory: PricePoint[];
  lots: Lot[];
  loading?: boolean;
}

type Range = '1M' | '3M' | '6M' | 'All';

function buildChartData(priceHistory: PricePoint[], lots: Lot[]) {
  if (priceHistory.length === 0 || lots.length === 0) return [];

  // Sort price history oldest → newest
  const sorted = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));

  return sorted
    .map(({ date, price }) => {
      // Lots owned on this date
      const owned = lots.filter(l => {
        const bought = String(l.date_bought).split('T')[0];
        return bought <= date.split('T')[0];
      });
      if (owned.length === 0) return null;

      const value    = owned.reduce((s, l) => s + l.weight * price, 0);
      const invested = owned.reduce((s, l) => s + l.weight * l.buy_price, 0);
      const pnl      = value - invested;

      return { date, value, invested, pnl };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

function filterByRange(data: ReturnType<typeof buildChartData>, range: Range) {
  if (range === 'All') return data;
  const days = range === '1M' ? 30 : range === '3M' ? 90 : 180;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return data.filter(d => d.date.split('T')[0] >= cutoffStr);
}

function formatThb(val: number): string {
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}฿${(abs / 1_000).toFixed(0)}k`;
  return `${sign}฿${abs}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value    = payload.find((p: { dataKey: string }) => p.dataKey === 'value')?.value;
  const invested = payload.find((p: { dataKey: string }) => p.dataKey === 'invested')?.value;
  const pnl      = value != null && invested != null ? value - invested : null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs shadow-lg">
      <p className="text-slate-400 mb-1.5">{formatDate(label)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Portfolio value</span>
          <span className="text-yellow-300 font-mono font-semibold">{formatThb(Math.round(value))}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Amount invested</span>
          <span className="text-slate-300 font-mono">{formatThb(Math.round(invested))}</span>
        </div>
        {pnl !== null && (
          <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 mt-1">
            <span className="text-slate-500">Unrealised P&L</span>
            <span className={`font-mono font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{formatThb(Math.round(pnl))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortfolioChart({ priceHistory, lots, loading }: Props) {
  const [range, setRange] = useState<Range>('3M');

  const allData   = useMemo(() => buildChartData(priceHistory, lots), [priceHistory, lots]);
  const chartData = useMemo(() => filterByRange(allData, range), [allData, range]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-40 mb-4" />
        <div className="h-48 bg-slate-800 rounded" />
      </div>
    );
  }

  if (chartData.length === 0) return null;

  const latest   = chartData[chartData.length - 1];
  const earliest = chartData[0];
  const totalPnl = latest.value - latest.invested;
  const startPnl = earliest.value - earliest.invested;
  const pnlChange = totalPnl - startPnl;

  // Y-axis domain with 5% padding
  const values = chartData.flatMap(d => [d.value, d.invested]);
  const yMin = Math.floor(Math.min(...values) * 0.97 / 100000) * 100000;
  const yMax = Math.ceil(Math.max(...values)  * 1.03 / 100000) * 100000;

  const ranges: Range[] = ['1M', '3M', '6M', 'All'];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-yellow-500 pl-2">
            Portfolio Value History
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 pl-3">
            Current value{' '}
            <span className="text-yellow-300 font-mono font-semibold">
              {formatThb(Math.round(latest.value))}
            </span>
            {' '}·{' '}
            P&L{' '}
            <span className={`font-mono font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatThb(Math.round(totalPnl))}
            </span>
            {pnlChange !== 0 && (
              <span className={`ml-2 ${pnlChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({pnlChange >= 0 ? '+' : ''}{formatThb(Math.round(pnlChange))} this period)
              </span>
            )}
          </p>
        </div>

        {/* Range selector */}
        <div className="flex gap-1">
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                range === r
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#eab308" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#475569" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#475569" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatThb}
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[yMin, yMax]}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Invested amount — shown as filled area underneath */}
          <Area
            type="monotone"
            dataKey="invested"
            stroke="#475569"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="url(#investedGrad)"
            dot={false}
            activeDot={false}
          />
          {/* Portfolio value — shown as main area on top */}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#eab308"
            strokeWidth={2}
            fill="url(#valueGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#eab308', strokeWidth: 0 }}
          />
          {/* Break-even reference */}
          <ReferenceLine
            y={latest.invested}
            stroke="#334155"
            strokeDasharray="2 4"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-yellow-500" />
          <span className="text-xs text-slate-500">Portfolio value</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-slate-500" style={{ borderTop: '1px dashed #475569' }} />
          <span className="text-xs text-slate-500">Amount invested</span>
        </div>
        <span className="text-xs text-slate-600 ml-auto">Gap = unrealised P&L</span>
      </div>
    </div>
  );
}
