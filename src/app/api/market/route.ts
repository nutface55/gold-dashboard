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
  // 10-year real yield (TIPS) — replaces nominal TNX as gold signal
  realYield: number | null;
  realYieldChange: number | null;
  // 10-year inflation breakeven (T10YIE)
  inflationBreakeven: number | null;
  // Gold / Silver ratio
  goldSilverRatio: number | null;
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

// FRED API — generic series fetch (last 2 observations for change calculation)
async function fetchFredSeries(seriesId: string, limit = 2): Promise<number[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&sort_order=desc&limit=${limit}&file_type=json`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const obs: { value: string }[] = data?.observations ?? [];
    return obs
      .map(o => o.value !== '.' ? parseFloat(o.value) : null)
      .filter((v): v is number => v !== null);
  } catch {
    return [];
  }
}

// FRED API — current Fed funds rate (DFF)
async function fetchFedRate(): Promise<number | null> {
  const vals = await fetchFredSeries('DFF', 1);
  return vals[0] ?? null;
}

// FRED API — 10-year real yield / TIPS (DFII10)
async function fetchRealYield(): Promise<{ current: number | null; change: number | null }> {
  const vals = await fetchFredSeries('DFII10', 2);
  if (vals.length === 0) return { current: null, change: null };
  const current = vals[0];
  const prev = vals[1] ?? null;
  const change = prev !== null ? Math.round((current - prev) * 100) / 100 : null;
  return { current, change };
}

// FRED API — 10-year inflation breakeven (T10YIE)
async function fetchInflationBreakeven(): Promise<number | null> {
  const vals = await fetchFredSeries('T10YIE', 1);
  return vals[0] ?? null;
}

// Gold / Silver ratio from Yahoo Finance
async function fetchGoldSilverRatio(): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [goldData, silverData]: any[] = await Promise.all([
      yahooFetch('GC=F', '5d'),
      yahooFetch('SI=F', '5d'),
    ]);
    const goldCloses: number[] = (goldData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((c: number | null): c is number => c != null && c > 0);
    const silverCloses: number[] = (silverData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((c: number | null): c is number => c != null && c > 0);
    if (goldCloses.length === 0 || silverCloses.length === 0) return null;
    const ratio = goldCloses[goldCloses.length - 1] / silverCloses[silverCloses.length - 1];
    return Math.round(ratio * 10) / 10;
  } catch {
    return null;
  }
}

export async function GET() {
  const [goldData, dxy, vixData, usdThb, fedRate, realYield, inflationBreakeven, goldSilverRatio] = await Promise.all([
    fetchGoldData(),
    fetchYahooIndicator('DX-Y.NYB'),
    fetchYahooIndicator('^VIX'),
    fetchUsdThb(),
    fetchFedRate(),
    fetchRealYield(),
    fetchInflationBreakeven(),
    fetchGoldSilverRatio(),
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
    realYield: realYield.current,
    realYieldChange: realYield.change,
    inflationBreakeven,
    goldSilverRatio,
    vix: vixData.current,
    fedRate,
    source: 'Yahoo Finance + open.er-api.com + FRED',
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=300' },
  });
}
