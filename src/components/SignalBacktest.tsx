'use client';

import { useMemo } from 'react';
import { calculateBollingerBands } from '@/lib/band-calculator';
import { FlaskConical } from 'lucide-react';

interface PricePoint { date: string; price: number }

interface Props {
  priceHistory: PricePoint[];
}

type Zone = 'strong_buy' | 'hold_buy' | 'hold' | 'mild_sell' | 'strong_sell';

interface SignalDay {
  date: string;
  price: number;
  zone: Zone;
}

interface TradePair {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  daysHeld: number;
  profitPerBaht: number;
}

function computeSignals(history: PricePoint[]): SignalDay[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const out: SignalDay[] = [];

  for (let i = 19; i < sorted.length; i++) {
    const prices = sorted.slice(i - 19, i + 1).map(p => p.price);
    const { sma, upperBand, lowerBand } = calculateBollingerBands(prices);
    const price = sorted[i].price;

    let zone: Zone;
    if (price > upperBand)        zone = 'strong_sell';
    else if (price > sma)         zone = 'mild_sell';
    else if (price >= sma * 0.98) zone = 'hold';
    else if (price > lowerBand)   zone = 'hold_buy';
    else                          zone = 'strong_buy';

    out.push({ date: sorted[i].date.split('T')[0], price, zone });
  }
  return out;
}

function simulatePairs(signals: SignalDay[]): TradePair[] {
  const pairs: TradePair[] = [];
  const opens: { date: string; price: number }[] = [];

  for (const day of signals) {
    if (day.zone === 'strong_buy') {
      opens.push({ date: day.date, price: day.price });
    } else if (day.zone === 'strong_sell' && opens.length > 0) {
      const buy = opens.shift()!;
      const daysHeld = Math.round(
        (new Date(day.date).getTime() - new Date(buy.date).getTime()) / 86_400_000
      );
      pairs.push({
        buyDate: buy.date,
        buyPrice: buy.price,
        sellDate: day.date,
        sellPrice: day.price,
        daysHeld,
        profitPerBaht: day.price - buy.price,
      });
    }
  }
  return pairs;
}

// What % of signals led to a favourable price N days later
function forwardHitRate(
  signals: SignalDay[],
  zone: 'strong_buy' | 'strong_sell',
  days: number
): number | null {
  const targets = signals.filter(s => s.zone === zone);
  let checked = 0, hits = 0;

  for (const t of targets) {
    const cutoff = new Date(t.date);
    cutoff.setDate(cutoff.getDate() + days);
    const future = signals.find(s => new Date(s.date) >= cutoff);
    if (!future) continue;
    checked++;
    if (zone === 'strong_buy'  && future.price > t.price) hits++;
    if (zone === 'strong_sell' && future.price < t.price) hits++;
  }

  return checked > 0 ? Math.round((hits / checked) * 100) : null;
}

function formatThb(v: number) {
  if (Math.abs(v) >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `฿${(v / 1_000).toFixed(0)}k`;
  return `฿${v.toLocaleString()}`;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function HitBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-600 text-xs">n/a</span>;
  const color = pct >= 75 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-mono font-semibold text-sm ${color}`}>{pct}%</span>;
}

export default function SignalBacktest({ priceHistory }: Props) {
  const signals = useMemo(() => computeSignals(priceHistory), [priceHistory]);
  const pairs   = useMemo(() => simulatePairs(signals), [signals]);

  if (signals.length < 30) return null;

  // Signal counts
  const strongBuyDays  = signals.filter(s => s.zone === 'strong_buy').length;
  const strongSellDays = signals.filter(s => s.zone === 'strong_sell').length;

  // Forward hit rates
  const buyHit30  = forwardHitRate(signals, 'strong_buy', 30);
  const buyHit60  = forwardHitRate(signals, 'strong_buy', 60);
  const buyHit90  = forwardHitRate(signals, 'strong_buy', 90);
  const sellHit30 = forwardHitRate(signals, 'strong_sell', 30);
  const sellHit60 = forwardHitRate(signals, 'strong_sell', 60);
  const sellHit90 = forwardHitRate(signals, 'strong_sell', 90);

  // Trade pair stats
  const wins       = pairs.filter(p => p.profitPerBaht > 0).length;
  const winRate    = pairs.length > 0 ? Math.round((wins / pairs.length) * 100) : null;
  const avgProfit  = pairs.length > 0
    ? Math.round(pairs.reduce((s, p) => s + p.profitPerBaht, 0) / pairs.length)
    : null;
  const totalProfit5B = pairs.reduce((s, p) => s + p.profitPerBaht * 5, 0);
  const avgDaysHeld   = pairs.length > 0
    ? Math.round(pairs.reduce((s, p) => s + p.daysHeld, 0) / pairs.length)
    : null;
  const openBuys      = signals.filter(s => s.zone === 'strong_buy').length - pairs.length;

  const recentPairs = [...pairs].reverse().slice(0, 5);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-purple-500 pl-2">
          Signal Backtest
        </h3>
        <span className="text-xs text-slate-600 ml-auto">{signals.length} days of data</span>
      </div>

      {/* Forward hit rates */}
      <div className="mb-4">
        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
          Signal quality — was price higher/lower N days after the signal?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Strong Buy */}
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-slate-400 font-medium">Strong Buy</span>
              <span className="text-xs text-slate-600 ml-auto">{strongBuyDays} days</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[['30d', buyHit30], ['60d', buyHit60], ['90d', buyHit90]].map(([label, val]) => (
                <div key={label as string}>
                  <div className="text-xs text-slate-600 mb-0.5">{label}</div>
                  <HitBadge pct={val as number | null} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">price was higher after X days</p>
          </div>

          {/* Strong Sell */}
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-slate-400 font-medium">Strong Sell</span>
              <span className="text-xs text-slate-600 ml-auto">{strongSellDays} days</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[['30d', sellHit30], ['60d', sellHit60], ['90d', sellHit90]].map(([label, val]) => (
                <div key={label as string}>
                  <div className="text-xs text-slate-600 mb-0.5">{label}</div>
                  <HitBadge pct={val as number | null} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">price was lower after X days</p>
          </div>
        </div>
      </div>

      {/* Trade pair simulation */}
      <div>
        <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
          Simulated trades — buy at strong buy, sell at strong sell (5B each)
        </p>

        {pairs.length === 0 ? (
          <div className="bg-slate-800/50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500">
              No completed buy→sell pairs yet — strong buy and strong sell signals haven&apos;t both fired in the same cycle.
            </p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-center">
                <div className="text-lg font-bold text-slate-200">{pairs.length}</div>
                <div className="text-xs text-slate-500">Completed pairs</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-center">
                <div className={`text-lg font-bold ${(winRate ?? 0) >= 70 ? 'text-green-400' : (winRate ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {winRate}%
                </div>
                <div className="text-xs text-slate-500">Win rate</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-center">
                <div className={`text-lg font-bold ${(avgProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {avgProfit !== null ? formatThb(avgProfit) : '—'}
                </div>
                <div className="text-xs text-slate-500">Avg profit/baht</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-center">
                <div className={`text-lg font-bold ${totalProfit5B >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalProfit5B >= 0 ? '+' : ''}{formatThb(totalProfit5B)}
                </div>
                <div className="text-xs text-slate-500">Total on 5B trades</div>
              </div>
            </div>

            {avgDaysHeld !== null && (
              <p className="text-xs text-slate-600 mb-2">
                Avg hold time: <span className="text-slate-400">{avgDaysHeld} days</span> per cycle
                {openBuys > 0 && (
                  <span className="ml-2">· <span className="text-yellow-600">{openBuys} open buy{openBuys > 1 ? 's' : ''} awaiting a sell signal</span></span>
                )}
              </p>
            )}

            {/* Recent pairs table */}
            <div className="space-y-1">
              {recentPairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800/40 rounded px-3 py-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-500">Buy </span>
                    <span className="text-slate-300 font-mono">{p.buyPrice.toLocaleString()}</span>
                    <span className="text-slate-600 mx-1">({fmt(p.buyDate)})</span>
                    <span className="text-slate-500">→ Sell </span>
                    <span className="text-slate-300 font-mono">{p.sellPrice.toLocaleString()}</span>
                    <span className="text-slate-600 mx-1">({fmt(p.sellDate)})</span>
                    <span className="text-slate-500">{p.daysHeld}d</span>
                  </div>
                  <div className={`font-mono font-semibold whitespace-nowrap ${p.profitPerBaht >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.profitPerBaht >= 0 ? '+' : ''}{p.profitPerBaht.toLocaleString()}/B
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-slate-700 mt-4 pt-3 border-t border-slate-800">
        Backtest uses your real Thai gold price history. Strong Buy = price below lower Bollinger Band. Strong Sell = above upper band. FIFO matching.
      </p>
    </div>
  );
}
