import { NextResponse } from 'next/server';

export interface MarketData {
  // Gold & FX
  usdSpot: number | null;
  usdThb: number | null;
  impliedThbPerBaht: number | null;
  // Dollar index
  dxyChange: number | null;
  // Gold momentum
  goldChange7d: number | null;
  gold52wHigh: number | null;
  gold52wLow: number | null;
  // 10-year Treasury yield
  tnxYield: number | null;
  tnxChange: number | null;
  // VIX fear index
  vix: number | null;
  // Fed
  fedRate: number | null;
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

// Returns { current, change } from last two daily closes
async function fetchYahooIndicator(symbol: string): Promise<{ current: number | null; change: number | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await yahooFetch(symbol, '5d');
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c): c is number => c != null && c > 0);
    if (valid.length === 0) return { current: null, change: null };
    const current = valid[valid.length - 1];
    const prev = valid.length >= 2 ? valid[valid.length - 2] : null;
    const change = prev ? Math.round(((current - prev) / prev) * 1000) / 10 : null;
    return { current: Math.round(current * 100) / 100, change };
  } catch {
    return { current: null, change: null };
  }
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
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const spot: number | null = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
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

// FRED API — current Fed funds rate (DFF = daily effective rate)
async function fetchFedRate(): Promise<number | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${key}&sort_order=desc&limit=1&file_type=json`,
      { next: { revalidate: 3600 } } // cache 1 hour
    );
    if (!res.ok) return null;
    const data = await res.json();
    const val = data?.observations?.[0]?.value;
    return val && val !== '.' ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [goldData, dxy, tnx, vixData, usdThb, fedRate] = await Promise.all([
    fetchGoldData(),
    fetchYahooIndicator('DX-Y.NYB'),
    fetchYahooIndicator('^TNX'),
    fetchYahooIndicator('^VIX'),
    fetchUsdThb(),
    fetchFedRate(),
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
    dxyChange: dxy.change,
    goldChange7d: goldData.change7d,
    gold52wHigh: goldData.high52w,
    gold52wLow: goldData.low52w,
    tnxYield: tnx.current,
    tnxChange: tnx.change,
    vix: vixData.current,
    fedRate,
    source: 'Yahoo Finance + open.er-api.com + FRED',
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=300' },
  });
}
