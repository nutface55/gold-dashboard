import { NextResponse } from 'next/server';

export interface MarketData {
  usdSpot: number | null;
  usdThb: number | null;
  impliedThbPerBaht: number | null;
  dxyChange: number | null;
  goldChange7d: number | null;
  gold52wHigh: number | null;
  gold52wLow: number | null;
  source: string;
  fetchedAt: string;
}

async function yahooFetch(symbol: string, range = '5d'): Promise<unknown> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 900 } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchGoldData(): Promise<{
  spot: number | null;
  change7d: number | null;
  high52w: number | null;
  low52w: number | null;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await yahooFetch('GC=F', '1y');
    const meta = data?.chart?.result?.[0]?.meta;
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];

    const spot: number | null = meta?.regularMarketPrice ?? null;

    // Calculate 52-week high/low from actual closes — more reliable than meta fields
    // which can include futures contract rollover anomalies
    const valid = closes.filter((c): c is number => c != null && c > 0);
    const high52w = valid.length > 0 ? Math.round(Math.max(...valid)) : null;
    const low52w  = valid.length > 0 ? Math.round(Math.min(...valid)) : null;

    const current = valid[valid.length - 1] ?? null;
    const weekAgo = valid.length >= 6 ? valid[valid.length - 6] : valid[0] ?? null;
    const change7d = current && weekAgo
      ? Math.round(((current - weekAgo) / weekAgo) * 1000) / 10
      : null;

    return { spot, change7d, high52w, low52w };
  } catch {
    return { spot: null, change7d: null, high52w: null, low52w: null };
  }
}

// Try DX-Y.NYB first, fall back to DX=F (futures)
async function fetchDxy(): Promise<number | null> {
  for (const symbol of ['DX-Y.NYB', 'DX=F']) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await yahooFetch(symbol, '5d');
      const result = data?.chart?.result?.[0];
      const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
      const valid = closes.filter((c): c is number => c != null && c > 0);
      // Use last two closes to compute day-over-day change
      if (valid.length >= 2) {
        const prev = valid[valid.length - 2];
        const curr = valid[valid.length - 1];
        return Math.round(((curr - prev) / prev) * 1000) / 10;
      }
      // Fallback: compare regularMarketPrice to previousClose if available
      const meta = result?.meta;
      const value: number | null = meta?.regularMarketPrice ?? null;
      const prevClose: number | null = meta?.previousClose ?? null;
      if (value && prevClose) {
        return Math.round(((value - prevClose) / prevClose) * 1000) / 10;
      }
    } catch {
      // try next symbol
    }
  }
  return null;
}

async function fetchUsdThb(): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rates?.THB ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [goldData, dxyChange, usdThb] = await Promise.all([
    fetchGoldData(),
    fetchDxy(),
    fetchUsdThb(),
  ]);

  const BAHT_WEIGHT_G = 15.244;
  const TROY_OZ_G = 31.1035;
  const PURITY = 0.965;
  const impliedThbPerBaht =
    goldData.spot && usdThb
      ? Math.round(goldData.spot * (BAHT_WEIGHT_G / TROY_OZ_G) * PURITY * usdThb)
      : null;

  const result: MarketData = {
    usdSpot: goldData.spot,
    usdThb,
    impliedThbPerBaht,
    dxyChange,
    goldChange7d: goldData.change7d,
    gold52wHigh: goldData.high52w,
    gold52wLow: goldData.low52w,
    source: 'Yahoo Finance + open.er-api.com',
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=300' },
  });
}
