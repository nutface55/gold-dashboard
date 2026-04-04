import { NextResponse } from 'next/server';

export interface MarketData {
  usdSpot: number | null;
  usdThb: number | null;
  impliedThbPerBaht: number | null;
  dxyChange: number | null;       // % change from previous close
  goldChange7d: number | null;    // % change over last 5 trading days
  gold52wHigh: number | null;
  gold52wLow: number | null;
  source: string;
  fetchedAt: string;
}

async function fetchGoldData(): Promise<{
  spot: number | null;
  change7d: number | null;
  high52w: number | null;
  low52w: number | null;
}> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 900 } }
    );
    if (!res.ok) return { spot: null, change7d: null, high52w: null, low52w: null };
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];

    const spot: number | null = meta?.regularMarketPrice ?? null;
    const high52w: number | null = meta?.fiftyTwoWeekHigh ?? null;
    const low52w: number | null = meta?.fiftyTwoWeekLow ?? null;

    const valid = closes.filter((c): c is number => c != null);
    const current = valid[valid.length - 1] ?? null;
    const weekAgo = valid.length >= 6 ? valid[valid.length - 6] : valid[0] ?? null;
    const change7d = current && weekAgo ? Math.round(((current - weekAgo) / weekAgo) * 1000) / 10 : null;

    return { spot, change7d, high52w, low52w };
  } catch {
    return { spot: null, change7d: null, high52w: null, low52w: null };
  }
}

async function fetchDxy(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 900 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const value: number | null = meta?.regularMarketPrice ?? null;
    const prev: number | null = meta?.previousClose ?? null;
    return value && prev ? Math.round(((value - prev) / prev) * 1000) / 10 : null;
  } catch {
    return null;
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
