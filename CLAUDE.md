# Ally's Gold Rush — Dashboard

Personal trading dashboard for accumulating 96.5% Thai gold (baht weight) to 150B.
Strategy: sell high on Bollinger Band signals → wait → buy back more bricks than you sold.

## Stack

- **Framework:** Next.js App Router, TypeScript, Tailwind CSS
- **Database:** Neon Postgres via `@neondatabase/serverless`
- **Charts:** Recharts
- **Icons:** Lucide React
- **Scraping:** Axios + Cheerio (gold price from api.chnwt.dev)

## Deployment

- **Production:** https://gold-dashboard-nutface.vercel.app
- **GitHub:** `nutface55/gold-dashboard` (deploy from `main`)
- **Price cron:** `0 2,5,8 * * *` UTC = 9am / 12pm / 3pm Bangkok time

## Portfolio Tab Layout (`src/app/page.tsx`)

1. **Recommendations** → `TodaysMove` (single merged card)
2. **Portfolio** → `PortfolioMetrics` → `PortfolioChart`
3. **Positions** → `CashTracker` → `LotTable`
4. **History** → `CycleHistory`

Other tabs: Market, Cycle (`CyclePlanner`), Simulate (`SimulatorTab`)

## Key Components

| File | Purpose |
|---|---|
| `TodaysMove.tsx` | Single recommendation card: signal + which lot to sell + rebuy target (highlighted) + fresh capital signal |
| `TradablePool.tsx` | Ranks in-profit tradable lots by buy_price DESC (kept for potential reuse, not rendered in main tab) |
| `GoalTracker.tsx` | Fresh capital signal logic (kept, logic now inlined in TodaysMove) |
| `ActionPlan.tsx` | Original signal card (kept, superseded by TodaysMove) |
| `CyclePlanner.tsx` | Sell→buyback math: cash generated, bricks back at each tier |
| `BandPosition.tsx` | Bollinger Band visualiser (Market tab) |
| `CashTracker.tsx` | Tracks cash from a sale + records when deployed |

## Core Logic (`src/lib/`)

### `trading-rules.ts` — `generateActionPlan()`

Signal priority (top wins):

1. **Cash in hand** → buy_back (if `cashState.amount > 0`)
2. **Strong sell** → above upper band + tradable P&L ≥ 15% + RSI ≥ 70 (or unreliable)
3. **Mild sell** → ≥ 6% above SMA + tradable P&L ≥ 12% + RSI ≥ 65 (or unreliable)
4. **Strong buy** → price < tradable avg × 0.99 OR within 2% of lower band
5. **Mild buy** → price ≥ 3% below SMA
6. **Mild buy** → price 1–3% below SMA
7. **Hold** → default

Key rules:
- **Forever lock:** lot P&L ≥ 40% → never sell (or manually flagged `is_forever`)
- **Near-lock buffer:** lots with P&L 35–40% skipped in sell recommendations
- **Underwater lots:** lots where `sellPrice ≤ buy_price` excluded from sell list
- **Sell order:** highest `buy_price` first — every sell lowers the tradable avg
- **Uses tradable-only avg** for sell/buy signals (forever lots excluded)
- `rebuyStrategy: 'fast'` on mild_sell (aim for SMA), `'patient'` on strong_sell (aim for lower band)

### `band-calculator.ts`

- 20-day Bollinger Bands (SMA ± 2σ)
- Zones: `strong_sell` | `mild_sell` | `hold` | `hold_buy` | `strong_buy`
- Wilder's 14-period RSI; `rsiReliable: false` until 14+ real data points
- Falls back to synthetic price history when DB has < 20 price points

### `brick-calculator.ts`

- `calculateScenarios()` — rebuy math: how many bricks you get back at each price tier
- `calculateInjectionImpact()` — how fresh capital changes your overall avg buy price
- `formatMathVerification()` — human-readable math breakdown

## Trading Philosophy

- **Goal:** 150B total weight, never reduce permanently
- **Cycles:** sell a profitable lot → hold cash → buy back more bricks than you sold
- **Rebuy target:** mild_sell → aim for SMA (quick cycle); strong_sell → wait for lower band (bigger gain)
- **Forever lots:** once locked, they stay. The system degrades gracefully into buy-and-hold if cycling isn't working.
- **Signal validation:** buy signals ~100% hit rate; mild_sell ~75% (pullback ≥3% within 60 days). Good enough — no further tuning needed.

## Working Preferences

- **Commit + push together** when asked to push — don't just stage
- **Check for redundancy** before adding new display elements — same data shouldn't appear in two places
- **Don't over-engineer** — 75% hit rate on sell signals is good enough; complexity cost > marginal gain
- **Review changes before pushing** — re-read modified files for logic issues and edge cases
- **Be honest** about trade-offs; user asks "is this worth doing?" and expects a real answer, not just execution
