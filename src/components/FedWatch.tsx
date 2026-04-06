'use client';

import { ExternalLink, Calendar, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  fedRate: number | null;
  loading?: boolean;
}

// Fed meeting decision dates for 2026 — published annually in January
const FED_MEETINGS_2026 = [
  { decision: '2026-01-29', label: 'Jan 28–29' },
  { decision: '2026-03-19', label: 'Mar 18–19' },
  { decision: '2026-05-07', label: 'May 6–7' },
  { decision: '2026-06-18', label: 'Jun 17–18' },
  { decision: '2026-07-30', label: 'Jul 29–30' },
  { decision: '2026-09-17', label: 'Sep 16–17' },
  { decision: '2026-10-29', label: 'Oct 28–29' },
  { decision: '2026-12-10', label: 'Dec 9–10' },
];

function getNextMeeting() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const m of FED_MEETINGS_2026) {
    const d = new Date(m.decision);
    if (d >= today) {
      const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
      return { ...m, daysAway: days };
    }
  }
  return null;
}

function getRateSignal(rate: number): { text: string; color: string; Icon: React.ElementType } {
  if (rate <= 2.0) return { text: 'Rates are low — very supportive for gold', color: 'text-green-400', Icon: TrendingUp };
  if (rate <= 3.5) return { text: 'Rates are moderate — neutral for gold', color: 'text-yellow-400', Icon: Minus };
  return { text: 'Rates are high — headwind for gold', color: 'text-red-400', Icon: TrendingDown };
}

export default function FedWatch({ fedRate, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-12 bg-slate-800 rounded" />)}
        </div>
      </div>
    );
  }

  const next = getNextMeeting();
  const signal = fedRate !== null ? getRateSignal(fedRate) : null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-purple-500 pl-2">
          Fed Watch
        </h3>
        <a
          href="https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          CME FedWatch
        </a>
      </div>

      <div className="space-y-3">
        {/* Current rate */}
        <div className="bg-slate-800/50 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Current Fed Funds Rate</span>
            <span className="text-lg font-bold font-mono text-white">
              {fedRate !== null ? `${fedRate.toFixed(2)}%` : '—'}
            </span>
          </div>
          {signal && (
            <div className="flex items-center gap-2 mt-1">
              <signal.Icon className={`w-3.5 h-3.5 ${signal.color}`} />
              <span className={`text-sm ${signal.color}`}>{signal.text}</span>
            </div>
          )}
          {fedRate === null && (
            <p className="text-xs text-slate-600 mt-1">Add FRED_API_KEY to load live rate</p>
          )}
        </div>

        {/* Next meeting */}
        {next && (
          <div className="bg-slate-800/50 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500 uppercase tracking-wide">Next Meeting</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                next.daysAway <= 7
                  ? 'bg-yellow-900/50 text-yellow-400'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {next.daysAway === 0 ? 'Today' : next.daysAway === 1 ? 'Tomorrow' : `${next.daysAway} days away`}
              </span>
            </div>
            <div className="text-base font-semibold text-white">{next.label}, 2026</div>
            <p className="text-xs text-slate-500 mt-1">
              {next.daysAway <= 14
                ? 'Rate decision coming soon — gold may move on the announcement.'
                : 'No meeting imminent — watch for Fed member speeches for clues.'}
            </p>
          </div>
        )}

        {/* Upcoming meetings */}
        <div>
          <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">2026 Meeting Schedule</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FED_MEETINGS_2026.map(m => {
              const isPast = new Date(m.decision) < new Date();
              const isNext = next?.decision === m.decision;
              return (
                <div
                  key={m.decision}
                  className={`text-xs px-2 py-1 rounded font-mono ${
                    isNext
                      ? 'bg-purple-900/40 text-purple-300 border border-purple-700/50'
                      : isPast
                      ? 'text-slate-700'
                      : 'text-slate-500'
                  }`}
                >
                  {m.label}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-slate-600 pt-1">
          Rate cuts → gold goes up · Rate hikes → gold goes down · Check CME FedWatch for market probability.
        </p>
      </div>
    </div>
  );
}
