import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Known Thai gold bar prices anchored to real purchase dates
// These are actual market prices (what the shop charged) — real data points
const KNOWN_PRICES: { date: string; price: number }[] = [
  { date: '2025-05-24', price: 51120 },
  { date: '2025-05-31', price: 51070 },
  { date: '2025-08-09', price: 50700 },
  { date: '2025-11-04', price: 61000 },
  { date: '2026-02-02', price: 68350 },
  { date: '2026-03-06', price: 77300 },
  { date: '2026-03-20', price: 76500 },
  { date: '2026-03-21', price: 74850 },
  { date: '2026-03-27', price: 68950 },
  { date: '2026-04-03', price: 72000 },
];

function interpolatePrices(
  anchors: { date: string; price: number }[],
  days: number
): { date: string; price: number }[] {
  const sorted = [...anchors].sort((a, b) => a.date.localeCompare(b.date));
  const result: { date: string; price: number }[] = [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    // Find surrounding anchors
    let before = sorted[0];
    let after = sorted[sorted.length - 1];

    for (const anchor of sorted) {
      if (anchor.date <= dateStr) before = anchor;
      if (anchor.date >= dateStr && after.date > anchor.date) after = anchor;
    }

    // Find tightest brackets
    const lowerAnchors = sorted.filter(a => a.date <= dateStr);
    const upperAnchors = sorted.filter(a => a.date >= dateStr);
    before = lowerAnchors.length > 0 ? lowerAnchors[lowerAnchors.length - 1] : sorted[0];
    after = upperAnchors.length > 0 ? upperAnchors[0] : sorted[sorted.length - 1];

    let price: number;
    if (before.date === after.date) {
      price = before.price;
    } else {
      // Linear interpolation between the two anchor points
      const totalDays = (new Date(after.date).getTime() - new Date(before.date).getTime()) / 86400000;
      const elapsed = (new Date(dateStr).getTime() - new Date(before.date).getTime()) / 86400000;
      const t = totalDays > 0 ? elapsed / totalDays : 0;
      price = Math.round(before.price + (after.price - before.price) * t);
    }

    result.push({ date: dateStr, price });
  }

  return result;
}

export async function POST() {
  try {
    // Check if we already have enough history
    const existing = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM price_history`
    );
    const count = parseInt(existing[0]?.count || '0');

    if (count >= 60) {
      return NextResponse.json({
        success: true,
        message: `Already have ${count} price records — no backfill needed.`,
        inserted: 0,
      });
    }

    // Clear existing sparse data and start fresh
    await query(`DELETE FROM price_history`);

    // Generate interpolated daily prices for last 365 days
    const prices = interpolatePrices(KNOWN_PRICES, 365);

    // Insert all at once using individual inserts
    let inserted = 0;
    for (const p of prices) {
      await query(
        `INSERT INTO price_history (timestamp, source, gold_bar_buy, gold_bar_sell)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [
          new Date(p.date + 'T12:00:00.000Z').toISOString(),
          'backfill',
          p.price + 200,  // buy price (shop sells to you) = slightly higher
          p.price,        // sell price (shop buys from you)
        ]
      );
      inserted++;
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled ${inserted} days of price history using real purchase price anchors.`,
      inserted,
      priceRange: {
        from: prices[0],
        to: prices[prices.length - 1],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await query<{ count: string }>(`SELECT COUNT(*) as count FROM price_history`);
    const sample = await query(
      `SELECT timestamp::date as date, gold_bar_sell as price
       FROM price_history ORDER BY timestamp DESC LIMIT 5`
    );
    return NextResponse.json({ count: count[0]?.count, recent: sample });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
