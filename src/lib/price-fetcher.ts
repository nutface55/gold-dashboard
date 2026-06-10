import axios from 'axios';

export interface GoldPrice {
  barBuy: number;    // price you pay to buy from shop
  barSell: number;   // price shop pays you when you sell
  ornamentBuy: number;
  ornamentSell: number;
  source: string;
  timestamp: string;
  raw?: unknown;
}

// Primary: api.chnwt.dev — clean JSON, correct current prices
// Response: { response: { price: { gold_bar: { buy: "72,000.00", sell: "72,200.00" } } } }
// "buy" = shop buys from you (barSell), "sell" = shop sells to you (barBuy)
async function fetchFromChnwt(): Promise<GoldPrice | null> {
  try {
    const { data } = await axios.get('https://api.chnwt.dev/thai-gold-api/latest', {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const bar = data?.response?.price?.gold_bar;
    const orn = data?.response?.price?.gold;

    const barSell = parseFloat(String(bar?.buy || '0').replace(/,/g, ''));
    const barBuy  = parseFloat(String(bar?.sell || '0').replace(/,/g, ''));
    const ornSell = parseFloat(String(orn?.buy  || '0').replace(/,/g, ''));
    const ornBuy  = parseFloat(String(orn?.sell || '0').replace(/,/g, ''));

    if (!barBuy || !barSell) return null;

    return {
      barBuy,
      barSell,
      ornamentBuy: ornBuy || barBuy,
      ornamentSell: ornSell || barSell,
      source: 'api.chnwt.dev',
      timestamp: new Date().toISOString(),
      raw: data?.response,
    };
  } catch {
    return null;
  }
}

// Secondary: thaigold.info — array of { name, bid, ask }
// "สมาคมฯ" = GTA prices, "96.5%" = 96.5% bar prices
async function fetchFromThaigold(): Promise<GoldPrice | null> {
  try {
    const { data } = await axios.get('http://www.thaigold.info/RealTimeDataV2/gtdata_.json', {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!Array.isArray(data)) return null;

    // Find the 96.5% bar entry or GTA association entry
    const bar96 = data.find((d: { name: string }) => d.name === '96.5%');
    const gta   = data.find((d: { name: string }) => d.name === 'สมาคมฯ');
    const entry = bar96 || gta;

    if (!entry) return null;

    const barSell = parseFloat(String(entry.bid).replace(/,/g, ''));
    const barBuy  = parseFloat(String(entry.ask).replace(/,/g, ''));

    // Sanity check: current Thai gold should be between 50,000 and 200,000
    if (!barBuy || !barSell || barBuy < 50000 || barBuy > 200000) return null;

    return {
      barBuy,
      barSell,
      ornamentBuy: barBuy,
      ornamentSell: barSell,
      source: 'thaigold.info',
      timestamp: new Date().toISOString(),
      raw: entry,
    };
  } catch {
    return null;
  }
}

// Last resort: compute implied Thai gold price from XAU/USD (Yahoo Finance) + USD/THB (open.er-api.com)
// Formula: spot_usd × (15.244g/31.1035g) × 0.965 purity × usdThb
// barSell = implied (shop pays you ~spot), barBuy = implied + 200 (standard GTA spread)
async function fetchImpliedFromSpot(): Promise<GoldPrice | null> {
  try {
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
      fetch('https://open.er-api.com/v6/latest/USD'),
    ]);

    if (!goldRes.ok || !fxRes.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [goldData, fxData]: [any, any] = await Promise.all([goldRes.json(), fxRes.json()]);

    const spot: number | null = goldData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    const usdThb: number | null = fxData?.rates?.THB ?? null;

    if (!spot || !usdThb) return null;

    const BAHT_WEIGHT_G = 15.244;
    const TROY_OZ_G = 31.1035;
    const PURITY = 0.965;
    const implied = Math.round(spot * (BAHT_WEIGHT_G / TROY_OZ_G) * PURITY * usdThb);

    if (implied < 30000 || implied > 300000) return null;

    const barSell = implied;
    const barBuy  = implied + 200; // standard GTA spread

    return {
      barBuy,
      barSell,
      ornamentBuy: barBuy,
      ornamentSell: barSell,
      source: 'implied (XAU/USD+THB)',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchCurrentGoldPrice(): Promise<GoldPrice> {
  const sources = [fetchFromChnwt, fetchFromThaigold, fetchImpliedFromSpot];

  for (const fetchFn of sources) {
    const result = await fetchFn();
    if (result && result.barBuy > 0 && result.barSell > 0) {
      return result;
    }
  }

  return {
    barBuy: 0,
    barSell: 0,
    ornamentBuy: 0,
    ornamentSell: 0,
    source: 'unavailable',
    timestamp: new Date().toISOString(),
  };
}
