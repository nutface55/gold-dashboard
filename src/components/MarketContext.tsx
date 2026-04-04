'use client';

interface MarketData {
  usdSpot: number | null;
  usdThb: number | null;
  impliedThbPerBaht: number | null;
  dxyChange: number | null;
  goldChange7d: number | null;
  gold52wHigh: number | null;
  gold52wLow: number | null;
}

interface Signal {
  label: string;
  text: string;
  tone: 'green' | 'yellow' | 'red';
}

function getDxySignal(change: number | null): Signal | null {
  if (change === null) return null;
  if (change <= -0.3) return { label: 'Dollar trend', text: 'Dollar is weakening — good for gold', tone: 'green' };
  if (change >= 0.3)  return { label: 'Dollar trend', text: 'Dollar is strengthening — bad for gold', tone: 'red' };
  return { label: 'Dollar trend', text: 'Dollar is stable — not pushing gold either way', tone: 'yellow' };
}

function getMomentumSignal(change7d: number | null): Signal | null {
  if (change7d === null) return null;
  if (change7d >= 2)  return { label: 'This week', text: 'Gold has been rising this week', tone: 'green' };
  if (change7d <= -2) return { label: 'This week', text: 'Gold has been falling this week', tone: 'red' };
  return { label: 'This week', text: 'Gold has been mostly flat this week', tone: 'yellow' };
}

function get52wSignal(spot: number | null, high: number | null, low: number | null): Signal | null {
  if (!spot || !high || !low || high === low) return null;
  const position = (spot - low) / (high - low);
  if (position >= 0.85) return { label: 'Yearly range', text: 'Near its highest price in a year — be cautious buying more', tone: 'red' };
  if (position <= 0.25) return { label: 'Yearly range', text: 'Near its lowest price in a year — a good time to buy', tone: 'green' };
  return { label: 'Yearly range', text: 'Sitting in the middle of its yearly range', tone: 'yellow' };
}

function getOverall(signals: Signal[]): { text: string; tone: 'green' | 'yellow' | 'red' } {
  const greens = signals.filter(s => s.tone === 'green').length;
  const reds   = signals.filter(s => s.tone === 'red').length;

  if (greens >= 2 && reds === 0) return { text: 'Conditions are looking good for gold right now', tone: 'green' };
  if (greens >= 2 && reds === 1) return { text: 'More good signs than bad — conditions lean positive', tone: 'green' };
  if (reds >= 2 && greens === 0) return { text: 'Conditions are unfavorable — gold faces headwinds', tone: 'red' };
  if (reds >= 2 && greens === 1) return { text: 'More warning signs than good — be patient', tone: 'red' };
  return { text: 'Mixed signals — follow your action plan above', tone: 'yellow' };
}

const dot: Record<'green' | 'yellow' | 'red', string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
};

const text: Record<'green' | 'yellow' | 'red', string> = {
  green:  'text-green-400',
  yellow: 'text-yellow-400',
  red:    'text-red-400',
};

const border: Record<'green' | 'yellow' | 'red', string> = {
  green:  'border-green-500/30 bg-green-950/20',
  yellow: 'border-yellow-500/20 bg-yellow-950/10',
  red:    'border-red-500/30 bg-red-950/20',
};

interface Props {
  market: MarketData | null;
  loading?: boolean;
}

export default function MarketContext({ market, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-36 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800 rounded" />)}
        </div>
      </div>
    );
  }

  if (!market) return null;

  const signals = [
    getDxySignal(market.dxyChange),
    getMomentumSignal(market.goldChange7d),
    get52wSignal(market.usdSpot, market.gold52wHigh, market.gold52wLow),
  ].filter((s): s is Signal => s !== null);

  if (signals.length === 0) return null;

  const overall = getOverall(signals);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-blue-500 pl-2 mb-4">
        Market Conditions
      </h3>

      <div className="space-y-2 mb-4">
        {signals.map((signal) => (
          <div key={signal.label} className="flex items-start gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${dot[signal.tone]}`} />
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide mr-2">{signal.label}</span>
              <span className={`text-sm ${text[signal.tone]}`}>{signal.text}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${border[overall.tone]}`}>
        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${dot[overall.tone]}`} />
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wide mr-2">Overall</span>
          <span className={`text-sm font-medium ${text[overall.tone]}`}>{overall.text}</span>
        </div>
      </div>
    </div>
  );
}
