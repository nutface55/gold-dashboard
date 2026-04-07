import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Fetches a FRED series and returns { date, value } pairs
async function fetchFredHistory(seriesId: string, limit = 500): Promise<{ date: string; value: number }[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error('FRED_API_KEY not set');
  const res = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&sort_order=desc&limit=${limit}&file_type=json`
  );
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);
  const data = await res.json();
  return (data?.observations ?? [])
    .filter((o: { value: string }) => o.value !== '.')
    .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }));
}

// Thai gold formula: USD/oz × (15.244g / 31.1035g) × 0.965 purity × USD/THB
const BAHT_WEIGHT_G = 15.244;
const TROY_OZ_G = 31.1035;
const PURITY = 0.965;

function toThbPerBaht(usdPerOz: number, usdThb: number): number {
  return Math.round(usdPerOz * (BAHT_WEIGHT_G / TROY_OZ_G) * PURITY * usdThb);
}

export async function POST() {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    return NextResponse.json({ success: false, error: 'FRED_API_KEY not set in environment variables' }, { status: 400 });
  }

  try {
    // Fetch gold prices (USD/oz) and USD/THB rate from FRED
    const [goldHistory, fxHistory] = await Promise.all([
      fetchFredHistory('GOLDAMGBD228NLBM', 500), // London gold fixing, daily
      fetchFredHistory('DEXTHUS', 500),           // USD/THB daily exchange rate
    ]);

    // Build a date-keyed map for FX rates
    const fxMap = new Map(fxHistory.map(r => [r.date, r.value]));

    // Only process dates where we have both gold price and FX rate
    const rows = goldHistory
      .filter(g => fxMap.has(g.date))
      .map(g => {
        const usdThb = fxMap.get(g.date)!;
        const thbPerBaht = toThbPerBaht(g.value, usdThb);
        return {
          date: g.date,
          goldUsd: g.value,
          usdThb,
          thbPerBaht,
        };
      })
      .filter(r => r.thbPerBaht > 10000 && r.thbPerBaht < 500000); // sanity check

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching gold + FX data found' }, { status: 500 });
    }

    // Insert into price_history — skip dates that already have real scraped data
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const timestamp = `${row.date}T04:00:00.000Z`; // 11am Bangkok time
      const result = await query<{ id: number }>(
        `INSERT INTO price_history (timestamp, source, gold_bar_buy, gold_bar_sell)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [timestamp, 'fred-london-fix', row.thbPerBaht + 200, row.thbPerBaht]
      );
      if (result.length > 0) inserted++;
      else skipped++;
    }

    // Count total records now
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM price_history`);
    const totalCount = parseInt(countResult[0]?.count || '0');

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      totalRecords: totalCount,
      dateRange: {
        from: rows[rows.length - 1].date,
        to: rows[0].date,
      },
      sample: rows.slice(0, 3).map(r => ({
        date: r.date,
        goldUsd: r.goldUsd,
        usdThb: r.usdThb,
        thbPerBaht: r.thbPerBaht,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await query<{ count: string }>(`SELECT COUNT(*) as count FROM price_history`);
    const sources = await query<{ source: string; count: string }>(
      `SELECT source, COUNT(*) as count FROM price_history GROUP BY source ORDER BY count DESC`
    );
    return NextResponse.json({ totalRecords: count[0]?.count, bySource: sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
