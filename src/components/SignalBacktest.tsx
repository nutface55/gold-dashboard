'use client';

import { useMemo } from 'react';
import { calculateBollingerBands, calculateRSI } from '@/lib/band-calculator';
import { FlaskConical, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface PricePoint { date: string; price: number }
interface Props { priceHistory: PricePoint[] }

type Signal = 'strong_buy' | 'mild_buy' | 'hold' | 'mild_sell' | 'strong_sell';

interface DayData {
  date: string;
  price: number;
  signal: Signal;
}

// Classify each day using the same logic as the dashboard
// (minus P&L condition which requires portfolio state)
function classifyDay(
  price: number,
  sma: number,
  upperBand: number,
  lowerBand: number,
  rsi: number,
  rsiReliable: boolean
): Signal {
  const pctAboveSma = ((price - sma) / sma) * 100;

  // Buy signals — same as dashboard
  if (price <= lowerBand || pctAboveSma <= -5) return 'strong_buy';
  if (pctAboveSma <= -3) return 'mild_buy';

  // Sell signals — RSI-confirmed, same thresholds as dashboard
  const rsiOk = !rsiReliable; // skip filter if RSI not yet reliable
  if (price > upperBand && (rsiOk || rsi >= 70)) return 'strong_sell';
  if (pctAboveSma >= 6   && (rsiOk || rsi >= 65)) return 'mild_sell';

  return 'hold';
}

function computeDays(history: PricePoint[]): DayData[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const out: DayData[] = [];

  for (let i = 19; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i - 59), i + 1).map(p => p.price);
    const bbWindow = sorted.slice(i - 19, i + 1).map(p => p.price);
    const { sma, upperBand, lowerBand } = calculateBollingerBands(bbWindow);
    const { rsi, reliable } = calculateRSI(window);
    const price = sorted[i].price;

    out.push({
      date: sorted[i].date.split('T')[0],
      price,
      signal: classifyDay(price, sma, upperBand, lowerBand, rsi, reliable),
    });
  }
  return out;
}

// ── Metrics ────────────────────────────────────────────────────────────

// Buy signals: was price higher N days later?
function buyHitRate(days: DayData[], signal: Signal, forward: number) {
  const targets = days.filter(d => d.signal === signal);
  let checked = 0, hits = 0, totalMove = 0;

  for (const t of targets) {
    const cutoff = new Date(t.date);
    cutoff.setDate(cutoff.getDate() + forward);
    const future = days.find(d => new Date(d.date) >= cutoff);
    if (!future) continue;
    checked++;
    const pctChange = ((future.price - t.price) / t.price) * 100;
    totalMove += pctChange;
    if (future.price > t.price) hits++;
  }

  return {
    count: targets.length,
    checked,
    hitRate: checked > 0 ? Math.round((hits / checked) * 100) : null,
    avgMove: checked > 0 ? Math.round((totalMove / checked) * 10) / 10 : null,
  };
}

// Sell signals: did price pull back ≥3% at any point within 30 days?
// This is the right metric — the user sells high and waits for a dip to rebuy.
function sellHitRate(days: DayData[], signal: Signal, pullbackPct = 3, withinDays = 30) {
  const targets = days.filter(d => d.signal === signal);
  let checked = 0, hits = 0;
  let totalMaxPullback = 0;

  for (const t of targets) {
    const maxDate = new Date(t.date);
    maxDate.setDate(maxDate.getDate() + withinDays);

    const futureDays = days.filter(d => {
      const dd = new Date(d.date);
      return dd > new Date(t.date) && dd <= maxDate;
    });

    if (futureDays.length === 0) continue;
    checked++;

    const minPrice = Math.min(...futureDays.map(d => d.price));
    const pullback = ((t.price - minPrice) / t.price) * 100;
    totalMaxPullback += pullback;

    if (pullback >= pullbackPct) hits++;
  }

  return {
    count: targets.length,
    checked,
    hitRate: checked > 0 ? Math.round((hits / checked) * 100) : null,
    avgPullback: checked > 0 ? Math.round((totalMaxPullback / checked) * 10) / 10 : null,
  };
}

// ── UI ─────────────────────────────────────────────────────────────────

type Verdict = 'follow' | 'mixed' | 'ignore' | 'neutral';

function getVerdict(hitRate: number | null): Verdict {
  if (hitRate === null) return 'neutral';
  if (hitRate >= 80) return 'follow';
  if (hitRate >= 60) return 'mixed';
  return 'ignore';
}

const verdictConfig = {
  follow:  { Icon: CheckCircle2,  color: 'text-green-400',  bg: 'bg-green-900/30 border-green-700/40',  label: 'Reliable' },
  mixed:   { Icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', label: 'Use caution' },
  ignore:  { Icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/30',       label: 'Unreliable' },
  neutral: { Icon: AlertTriangle, color: 'text-slate-500',  bg: 'bg-slate-800/50 border-slate-700/30',   label: 'Neutral' },
};

interface SignalRow {
  signal: Signal;
  label: string;
  action: string;
  isSell: boolean;
  count: number;
  checked: number;
  hitRate: number | null;
  metric: string;        // e.g. "+4.8% avg 60d" or "3.2% avg dip"
  metricLabel: string;   // e.g. "avg 60d move" or "avg pullback"
}

export default function SignalBacktest({ priceHistory }: Props) {
  const days = useMemo(() => computeDays(priceHistory), [priceHistory]);

  if (days.length < 40) return null;

  // Compute stats for each signal
  const strongBuy = buyHitRate(days, 'strong_buy', 60);
  const mildBuy   = buyHitRate(days, 'mild_buy', 60);
  const mildSell  = sellHitRate(days, 'mild_sell', 3, 30);
  const strongSell = sellHitRate(days, 'strong_sell', 3, 30);

  const holdCount = days.filter(d => d.signal === 'hold').length;

  const rows: SignalRow[] = [
    {
      signal: 'strong_buy', label: 'Strong Buy', action: 'Buy now — stack hard', isSell: false,
      count: strongBuy.count, checked: strongBuy.checked,
      hitRate: strongBuy.hitRate,
      metric: strongBuy.avgMove !== null ? `${strongBuy.avgMove >= 0 ? '+' : ''}${strongBuy.avgMove}%` : '—',
      metricLabel: 'avg 60d move',
    },
    {
      signal: 'mild_buy', label: 'Mild Buy', action: 'Good entry — buy if able', isSell: false,
      count: mildBuy.count, checked: mildBuy.checked,
      hitRate: mildBuy.hitRate,
      metric: mildBuy.avgMove !== null ? `${mildBuy.avgMove >= 0 ? '+' : ''}${mildBuy.avgMove}%` : '—',
      metricLabel: 'avg 60d move',
    },
    {
      signal: 'hold', label: 'Hold', action: 'Wait — no clear edge', isSell: false,
      count: holdCount, checked: 0, hitRate: null,
      metric: '—', metricLabel: '',
    },
    {
      signal: 'mild_sell', label: 'Mild Sell', action: 'Sell if P&L ≥ 12% + RSI ≥ 65', isSell: true,
      count: mildSell.count, checked: mildSell.checked,
      hitRate: mildSell.hitRate,
      metric: mildSell.avgPullback !== null ? `${mildSell.avgPullback}%` : '—',
      metricLabel: 'avg pullback',
    },
    {
      signal: 'strong_sell', label: 'Strong Sell', action: 'Sell if P&L ≥ 15% + RSI ≥ 70', isSell: true,
      count: strongSell.count, checked: strongSell.checked,
      hitRate: strongSell.hitRate,
      metric: strongSell.avgPullback !== null ? `${strongSell.avgPullback}%` : '—',
      metricLabel: 'avg pullback',
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-purple-500 pl-2">
          Signal Validation
        </h3>
        <span className="text-xs text-slate-600 ml-auto">{days.length} days of data</span>
      </div>
      <p className="text-xs text-slate-500 mb-4 pl-3">
        Buy signals: was price higher 60 days later? · Sell signals: did price dip ≥3% within 30 days?
      </p>

      <div className="space-y-2">
        {rows.map(row => {
          const verdict = row.signal === 'hold' ? 'neutral' as Verdict : getVerdict(row.hitRate);
          const cfg = verdictConfig[verdict];
          const Icon = cfg.Icon;

          return (
            <div key={row.signal} className={`rounded-lg px-4 py-3 border ${cfg.bg}`}>
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-200">{row.label}</span>
                    <span className="text-xs text-slate-500">{row.action}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  {row.hitRate !== null ? (
                    <>
                      <div>
                        <div className={`text-sm font-mono font-semibold ${cfg.color}`}>
                          {row.hitRate}%
                        </div>
                        <div className="text-xs text-slate-600">hit rate</div>
                      </div>
                      <div>
                        <div className="text-sm font-mono font-semibold text-slate-300">
                          {row.metric}
                        </div>
                        <div className="text-xs text-slate-600">{row.metricLabel}</div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-600">—</div>
                  )}
                  <div className="text-xs text-slate-600 w-12 text-right">
                    {row.count}× fired
                  </div>
                </div>
              </div>

              <div className="mt-1.5 pl-7">
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                {row.checked > 0 && row.checked < row.count && (
                  <span className="text-xs text-slate-600 ml-2">
                    ({row.checked} of {row.count} had enough future data to test)
                  </span>
                )}
                {row.hitRate !== null && row.hitRate < 60 && row.isSell && (
                  <span className="text-xs text-slate-600 ml-2">
                    — not enough pullbacks to justify selling
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-700 mt-4 pt-3 border-t border-slate-800">
        Sell signals now require RSI confirmation (≥65 mild, ≥70 strong) + ≥6% above SMA. Sell hit = price dipped ≥3% within 30 days (enough to rebuy cheaper). The dashboard also requires P&L ≥ 12–15% before recommending a sale.
      </p>
    </div>
  );
}
