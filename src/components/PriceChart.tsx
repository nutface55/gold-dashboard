'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts';
import { BandData } from '@/lib/band-calculator';

interface PricePoint {
  date: string;
  price: number;
}

interface Props {
  priceHistory: PricePoint[];
  bands: BandData | null;
  currentPrice: number;
}

export default function PriceChart({ priceHistory, bands, currentPrice }: Props) {
  if (!bands || priceHistory.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Price Chart</h3>
        <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
          Collecting price history... Chart will appear after a few data points.
        </div>
      </div>
    );
  }

  const chartData = priceHistory.map(p => ({
    date: new Date(p.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
    price: p.price,
    sma: bands.sma,
    upper: bands.upperBand,
    lower: bands.lowerBand,
  }));

  const minPrice = Math.min(...priceHistory.map(p => p.price), bands.lowerBand) * 0.99;
  const maxPrice = Math.max(...priceHistory.map(p => p.price), bands.upperBand) * 1.01;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Price Chart — Bollinger Bands</h3>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" /> SMA (20d)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-500 inline-block border-dashed border-t border-slate-400" /> Bands</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Price</span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelStyle={{ color: '#a1a1aa' }}
              itemStyle={{ color: '#e4e4e7' }}
              formatter={(v) => [`฿${Number(v).toLocaleString()}`, '']}
            />
            {/* Band fill area */}
            <Area type="monotone" dataKey="upper" stroke="#52525b" strokeDasharray="4 4" fill="transparent" />
            <Area type="monotone" dataKey="lower" stroke="#52525b" strokeDasharray="4 4" fill="transparent" />
            {/* SMA */}
            <Line type="monotone" dataKey="sma" stroke="#eab308" strokeWidth={1.5} dot={false} />
            {/* Price */}
            <Line type="monotone" dataKey="price" stroke="#60a5fa" strokeWidth={2} dot={false} />
            {/* Current price line */}
            <ReferenceLine y={currentPrice} stroke="#60a5fa" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
