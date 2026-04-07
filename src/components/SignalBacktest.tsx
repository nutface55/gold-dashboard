'use client';

import { useMemo } from 'react';
import { calculateBollingerBands } from '@/lib/band-calculator';
import { FlaskConical, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface PricePoint { date: string; price: number }
interface Props { priceHistory: PricePoint[] }

type Zone = 'strong_buy' | 'hold_buy' | 'hold' | 'mild_sell' | 'strong_sell';

interface SignalDay { date: string; price: number; zone: Zone; pctAboveSma: number }

function computeSignals(history: PricePoint[]): SignalDay[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const out: SignalDay[] = [];

  for (let i = 19; i < sorted.length; i++) {
    const prices = sorted.slice(i - 19, i + 1).map(p => p.price);
    const { sma, upperBand, lowerBand } = calculateBollingerBands(prices);
    const price = sorted[i].price;
    const pctAboveSma = ((price - sma) / sma) * 100;

    let zone: Zone;
    if (price > upperBand)        zone = 'strong_sell';
    else if (price > sma)         zone = 'mild_sell';
    else if (price >= sma * 0.98) zone = 'hold';
    else if (price > lowerBand)   zone = 'hold_buy';
    else                          zone = 'strong_buy';

    out.push({ date: sorted[i].date.split('T')[0], price, zone, pctAboveSma });
  }
  return out;
}

interface SignalStats {
  zone: Zone;
  label: string;
  action: string;
  direction: 'up' | 'down' | 'none';
  count: number;
  hitRate60: number | null;   // % price moved in expected direction at 60d
  avgMove60: number | null;   // avg % price change at 60d
}

function analyseSignal(
  signals: SignalDay[],
  zone: Zone,
  direction: 'up' | 'down' | 'none'
): Pick<SignalStats, 'count' | 'hitRate60' | 'avgMove60'> {
  const targets = signals.filter(s => s.zone === zone);
  if (targets.length === 0) return { count: 0, hitRate60: null, avgMove60: null };

  let hits = 0, checked = 0, totalMove = 0;

  for (const t of targets) {
    const cutoff = new Date(t.date);
    cutoff.setDate(cutoff.getDate() + 60);
    const future = signals.find(s => new Date(s.date) >= cutoff);
    if (!future) continue;

    const pctChange = ((future.price - t.price) / t.price) * 100;
    checked++;
    totalMove += pctChange;
    if (direction === 'up'   && future.price > t.price) hits++;
    if (direction === 'down' && future.price < t.price) hits++;
    if (direction === 'none') hits++;
  }

  return {
    count: targets.length,
    hitRate60: checked > 0 ? Math.round((hits / checked) * 100) : null,
    avgMove60: checked > 0 ? Math.round((totalMove / checked) * 10) / 10 : null,
  };
}

type Verdict = 'follow' | 'mixed' | 'ignore' | 'neutral';

function getVerdict(direction: 'up' | 'down' | 'none', hitRate: number | null, avgMove: number | null): Verdict {
  if (direction === 'none') return 'neutral';
  if (hitRate === null) return 'neutral';
  if (direction === 'up') {
    if (hitRate >= 70 && (avgMove ?? 0) > 3)  return 'follow';
    if (hitRate >= 55)                          return 'mixed';
    return 'ignore';
  }
  // down
  if (hitRate >= 70 && (avgMove ?? 0) < -3)  return 'follow';
  if (hitRate >= 55)                           return 'mixed';
  return 'ignore';
}

const SIGNAL_DEFS: { zone: Zone; label: string; action: string; direction: 'up' | 'down' | 'none' }[] = [
  { zone: 'strong_buy',  label: 'Strong Buy',   action: 'Buy now — stack hard',      direction: 'up'   },
  { zone: 'hold_buy',    label: 'Mild Buy',      action: 'Good entry — buy if able',  direction: 'up'   },
  { zone: 'hold',        label: 'Hold',          action: 'Wait — no clear edge',      direction: 'none' },
  { zone: 'mild_sell',   label: 'Mild Sell',     action: 'Sell if P&L ≥ 12%',        direction: 'down' },
  { zone: 'strong_sell', label: 'Strong Sell',   action: 'Sell if P&L ≥ 15%',        direction: 'down' },
];

const verdictConfig = {
  follow:  { Icon: CheckCircle2,  color: 'text-green-400',  bg: 'bg-green-900/30 border-green-700/40',  label: 'Follow it' },
  mixed:   { Icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', label: 'Use caution' },
  ignore:  { Icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/30',       label: 'Unreliable' },
  neutral: { Icon: AlertTriangle, color: 'text-slate-500',  bg: 'bg-slate-800/50 border-slate-700/30',   label: 'Neutral' },
};

export default function SignalBacktest({ priceHistory }: Props) {
  const signals = useMemo(() => computeSignals(priceHistory), [priceHistory]);

  if (signals.length < 40) return null;

  const stats: SignalStats[] = SIGNAL_DEFS.map(def => {
    const { count, hitRate60, avgMove60 } = analyseSignal(signals, def.zone, def.direction);
    return { ...def, count, hitRate60, avgMove60 };
  });

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-purple-500 pl-2">
          Signal Validation
        </h3>
        <span className="text-xs text-slate-600 ml-auto">{signals.length} days of data</span>
      </div>
      <p className="text-xs text-slate-500 mb-4 pl-3">
        When each signal fires, does price move the right way 60 days later?
      </p>

      <div className="space-y-2">
        {stats.map(s => {
          const verdict = getVerdict(s.direction, s.hitRate60, s.avgMove60);
          const cfg = verdictConfig[verdict];
          const Icon = cfg.Icon;
          const noData = s.hitRate60 === null;

          return (
            <div key={s.zone} className={`rounded-lg px-4 py-3 border ${cfg.bg}`}>
              <div className="flex items-center gap-3">
                {/* Verdict icon */}
                <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />

                {/* Signal name + action */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-200">{s.label}</span>
                    <span className="text-xs text-slate-500">{s.action}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  {s.direction !== 'none' && !noData ? (
                    <>
                      <div>
                        <div className={`text-sm font-mono font-semibold ${cfg.color}`}>
                          {s.hitRate60}%
                        </div>
                        <div className="text-xs text-slate-600">hit rate</div>
                      </div>
                      <div>
                        <div className={`text-sm font-mono font-semibold ${(s.avgMove60 ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(s.avgMove60 ?? 0) >= 0 ? '+' : ''}{s.avgMove60}%
                        </div>
                        <div className="text-xs text-slate-600">avg 60d move</div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-600">—</div>
                  )}
                  <div className="text-xs text-slate-600 w-10 text-right">
                    {s.count}× fired
                  </div>
                </div>
              </div>

              {/* Verdict label */}
              <div className="mt-1.5 pl-7">
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                {verdict === 'ignore' && s.direction === 'down' && (
                  <span className="text-xs text-slate-600 ml-2">
                    — gold has been in a bull run; sell signals fire too early
                  </span>
                )}
                {noData && s.direction !== 'none' && (
                  <span className="text-xs text-slate-600 ml-2">— not enough data yet (fired too recently)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-700 mt-4 pt-3 border-t border-slate-800">
        Hit rate = % of times price moved in the expected direction 60 days after the signal. Sell signals use band position only; the dashboard also requires P&L ≥ 12–15% before recommending a sale.
      </p>
    </div>
  );
}
