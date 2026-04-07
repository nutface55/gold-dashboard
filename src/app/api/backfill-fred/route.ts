import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Thai gold formula: USD/oz × (15.244g / 31.1035g) × 0.965 purity × USD/THB
const BAHT_WEIGHT_G = 15.244;
const TROY_OZ_G = 31.1035;
const PURITY = 0.965;

function toThbPerBaht(usdPerOz: number, usdThb: number): number {
  return Math.round(usdPerOz * (BAHT_WEIGHT_G / TROY_OZ_G) * PURITY * usdThb);
}

async function yahooHistory(symbol: string, range: string): Promise<{ date: string; value: number }[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      value: closes[i] ?? null,
    }))
    .filter((r): r is { date: string; value: number } => r.value !== null && r.value > 0);
}

export async function POST() {
  try {
    // Fetch 2 years of daily gold (GC=F) and USD/THB (THB=X) from Yahoo Finance
    const [goldHistory, fxHistory] = await Promise.all([
      yahooHistory('GC=F', '2y'),
      yahooHistory('THB=X', '2y'),
    ]);

    if (goldHistory.length === 0) {
      return NextResponse.json({ success: false, error: 'Yahoo Finance returned no gold data' }, { status: 500 });
    }

    // Build date-keyed map for FX — forward-fill weekends using last known rate
    const fxMap = new Map(fxHistory.map(r => [r.date, r.value]));

    // For missing FX dates, fill forward from the nearest prior date
    const allDates = [...new Set([...goldHistory.map(g => g.date)])].sort();
    let lastFx: number | null = null;
    for (const date of allDates) {
      if (fxMap.has(date)) {
        lastFx = fxMap.get(date)!;
      } else if (lastFx !== null) {
        fxMap.set(date, lastFx); // forward-fill
      }
    }

    const rows = goldHistory
      .filter(g => fxMap.has(g.date))
      .map(g => {
        const usdThb = fxMap.get(g.date)!;
        const thbPerBaht = toThbPerBaht(g.value, usdThb);
        return { date: g.date, goldUsd: Math.round(g.value), usdThb: Math.round(usdThb * 100) / 100, thbPerBaht };
      })
      .filter(r => r.thbPerBaht > 10000 && r.thbPerBaht < 500000);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid rows after conversion' }, { status: 500 });
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const timestamp = `${row.date}T04:00:00.000Z`; // 11am Bangkok time
      const result = await query<{ id: number }>(
        `INSERT INTO price_history (timestamp, source, gold_bar_buy, gold_bar_sell)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [timestamp, 'yahoo-backfill', row.thbPerBaht + 200, row.thbPerBaht]
      );
      if (result.length > 0) inserted++;
      else skipped++;
    }

    const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM price_history`);
    const totalCount = parseInt(countResult[0]?.count || '0');

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      totalRecords: totalCount,
      dateRange: { from: rows[rows.length - 1].date, to: rows[0].date },
      sample: rows.slice(0, 3),
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

// DELETE: remove old interpolated backfill records superseded by yahoo-backfill (v2)
export async function DELETE() {
  try {
    const deleted = await query<{ count: string }>(
      `WITH removed AS (
        DELETE FROM price_history WHERE source = 'backfill' RETURNING id
       )
       SELECT COUNT(*) as count FROM removed`
    );
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM price_history`);
    return NextResponse.json({
      success: true,
      deleted: parseInt(deleted[0]?.count || '0'),
      totalRecords: parseInt(countResult[0]?.count || '0'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
