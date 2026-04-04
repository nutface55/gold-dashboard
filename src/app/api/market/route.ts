import { NextResponse } from 'next/server';

interface MarketData {
  usdSpot: number | null;
  usdThb: number | null;
  impliedThbPerBaht: number | null;
  source: string;
  fetchedAt: string;
}

// USD/THB from open.er-api.com — completely free, no key required
async function fetchUsdThb(): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 900 }, // cache 15 min
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rates?.THB ?? null;
  } catch {
    return null;
  }
}

// USD gold spot from Yahoo Finance public endpoint (GC=F = gold futures front month)
async function fetchUsdGoldSpot(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 900 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data?.chart?.result?.[0]?.meta;
    const price = quote?.regularMarketPrice ?? quote?.previousClose ?? null;
    return price ? Math.round(price * 100) / 100 : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [usdThb, usdSpot] = await Promise.all([fetchUsdThb(), fetchUsdGoldSpot()]);

  // Derive approximate Thai gold price per baht weight:
  // 1 troy oz = 31.1035g | 1 baht weight = 15.244g | purity = 96.5%
  // Thai price (฿/baht) ≈ usdSpot × (15.244 / 31.1035) × 0.965 × usdThb
  const BAHT_WEIGHT_G = 15.244;
  const TROY_OZ_G = 31.1035;
  const PURITY = 0.965;
  const impliedThbPerBaht =
    usdSpot && usdThb
      ? Math.round(usdSpot * (BAHT_WEIGHT_G / TROY_OZ_G) * PURITY * usdThb)
      : null;

  const result: MarketData = {
    usdSpot,
    usdThb,
    impliedThbPerBaht,
    source: 'Yahoo Finance + open.er-api.com',
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=300' },
  });
}
