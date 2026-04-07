'use client';

import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SeasonalEvent {
  name: string;
  month: number;   // 1-12
  day: number;     // start day
  endMonth: number;
  endDay: number;
  tone: 'bullish' | 'bearish' | 'neutral';
  impact: string;  // one-liner shown in the card
  detail: string;  // why it affects gold
}

// Fixed-date annual events + 2026 lunar dates
const EVENTS: SeasonalEvent[] = [
  {
    name: 'Chinese New Year',
    month: 2, day: 17, endMonth: 2, endDay: 24,
    tone: 'bullish',
    impact: 'Strong gold buying — families gift gold for luck',
    detail: 'Thai-Chinese families traditionally buy gold bars and ornaments as New Year gifts. One of the biggest demand spikes of the year.',
  },
  {
    name: 'Thai Wedding Season (Spring)',
    month: 3, day: 1, endMonth: 5, endDay: 31,
    tone: 'bullish',
    impact: 'Wedding season — gold jewelry demand rises',
    detail: 'March–May is peak wedding season in Thailand. Gold necklaces and baht chains are standard wedding gifts, lifting local demand.',
  },
  {
    name: 'Songkran (Thai New Year)',
    month: 4, day: 13, endMonth: 4, endDay: 15,
    tone: 'bullish',
    impact: 'Mild gold buying — traditional New Year purchases',
    detail: 'Some Thai families buy gold around Songkran as a New Year tradition and auspicious start. Smaller impact than Chinese New Year but still notable.',
  },
  {
    name: 'Ghost Month',
    month: 7, day: 31, endMonth: 8, endDay: 28,
    tone: 'bearish',
    impact: 'Ghost Month — Chinese tradition suppresses gold buying',
    detail: 'The 7th lunar month (approx. Aug 2026). Thai-Chinese traditionally avoid major purchases including gold. Demand softens noticeably during this period.',
  },
  {
    name: "Mother's Day (Thailand)",
    month: 8, day: 12, endMonth: 8, endDay: 12,
    tone: 'neutral',
    impact: 'Minor lift — gold jewelry gifting',
    detail: "Thailand's Mother's Day (Queen Sirikit's birthday). Gold jewelry is a popular gift, giving a small short-term bump to ornament demand.",
  },
  {
    name: 'Diwali',
    month: 10, day: 20, endMonth: 10, endDay: 20,
    tone: 'bullish',
    impact: 'Global gold demand spike — Indian festival season',
    detail: 'Diwali is the single largest gold-buying event globally. India accounts for ~25% of world gold demand and buys heavily in October–November. Affects XAU/USD directly.',
  },
  {
    name: 'Thai Wedding Season (Autumn)',
    month: 10, day: 1, endMonth: 11, endDay: 30,
    tone: 'bullish',
    impact: 'Second wedding season — gold jewelry demand rises again',
    detail: 'October–November is the second peak wedding period in Thailand after the rainy season ends. Same dynamic as the spring season.',
  },
  {
    name: 'Year-End / New Year',
    month: 12, day: 20, endMonth: 1, endDay: 5,
    tone: 'neutral',
    impact: 'Mixed — profit-taking meets new-year buying',
    detail: 'December often sees profit-taking from year-end portfolio rebalancing, while January brings fresh buying. Net effect on gold is mixed but can be volatile.',
  },
];

function getStatus(event: SeasonalEvent, today: Date): 'active' | 'upcoming' | 'past' {
  const year = today.getFullYear();
  const start = new Date(year, event.month - 1, event.day);
  let end = new Date(year, event.endMonth - 1, event.endDay);
  // Handle year-wrap (e.g. Dec → Jan)
  if (event.endMonth < event.month) end = new Date(year + 1, event.endMonth - 1, event.endDay);

  if (today >= start && today <= end) return 'active';
  if (today < start) return 'upcoming';
  return 'past';
}

function getDaysAway(event: SeasonalEvent, today: Date): number {
  const year = today.getFullYear();
  const start = new Date(year, event.month - 1, event.day);
  if (start < today) {
    // Already past this year — next year
    const nextYear = new Date(year + 1, event.month - 1, event.day);
    return Math.ceil((nextYear.getTime() - today.getTime()) / 86400000);
  }
  return Math.ceil((start.getTime() - today.getTime()) / 86400000);
}

const toneConfig = {
  bullish: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    badge: 'bg-green-900/40 border-green-700/50 text-green-300',
    label: 'Bullish',
    Icon: TrendingUp,
  },
  bearish: {
    dot: 'bg-red-500',
    text: 'text-red-400',
    badge: 'bg-red-900/40 border-red-700/50 text-red-300',
    label: 'Bearish',
    Icon: TrendingDown,
  },
  neutral: {
    dot: 'bg-yellow-400',
    text: 'text-yellow-400',
    badge: 'bg-yellow-900/40 border-yellow-700/50 text-yellow-300',
    label: 'Neutral',
    Icon: Minus,
  },
};

export default function Seasonality() {
  const today = new Date();

  const active = EVENTS.filter(e => getStatus(e, today) === 'active');
  const upcoming = EVENTS
    .filter(e => getStatus(e, today) === 'upcoming')
    .sort((a, b) => getDaysAway(a, today) - getDaysAway(b, today))
    .slice(0, 3);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-3.5 h-3.5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-200 border-l-2 border-yellow-500 pl-2">
          Seasonal Gold Patterns
        </h3>
      </div>

      {/* Active events */}
      {active.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-slate-600 uppercase tracking-wide">Happening now</p>
          {active.map(e => {
            const cfg = toneConfig[e.tone];
            const Icon = cfg.Icon;
            return (
              <div key={e.name} className={`rounded-lg px-4 py-3 border ${cfg.badge}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
                  <span className="text-sm font-semibold text-white">{e.name}</span>
                  <span className={`text-xs ml-auto font-medium ${cfg.text}`}>{cfg.label}</span>
                </div>
                <p className={`text-xs font-medium ${cfg.text}`}>{e.impact}</p>
                <p className="text-xs text-slate-500 mt-1">{e.detail}</p>
              </div>
            );
          })}
        </div>
      )}

      {active.length === 0 && (
        <div className="mb-4 bg-slate-800/50 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">No major seasonal event active right now.</p>
        </div>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Coming up</p>
          {upcoming.map(e => {
            const cfg = toneConfig[e.tone];
            const days = getDaysAway(e, today);
            return (
              <div key={e.name} className="flex items-start gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200 font-medium">{e.name}</span>
                    <span className={`text-xs whitespace-nowrap px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d away`}
                    </span>
                  </div>
                  <p className={`text-xs ${cfg.text} mt-0.5`}>{e.impact}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-700 mt-4 pt-3 border-t border-slate-800">
        Patterns based on Thai & Chinese gold demand cycles, Indian festival buying, and local wedding seasons.
      </p>
    </div>
  );
}
