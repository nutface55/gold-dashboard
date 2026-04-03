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

// Fallback: scrape goldtraders.or.th with cheerio
async function fetchFromGoldtraders(): Promise<GoldPrice | null> {
  try {
    const cheerio = await import('cheerio');
    const { data: html } = await axios.get('https://www.goldtraders.or.th/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'th,en;q=0.9',
      },
    });

    const $ = cheerio.load(html);
    const prices: number[] = [];

    $('td, span, div').each((_, el) => {
      const text = $(el).text().trim().replace(/,/g, '');
      const num = parseFloat(text);
      if (num >= 50000 && num <= 200000) {
        prices.push(num);
      }
    });

    if (prices.length < 2) return null;

    const sorted = [...new Set(prices)].sort((a, b) => a - b);
    const barSell = sorted[0];
    const barBuy  = sorted[1] || sorted[0] + 200;

    return {
      barBuy,
      barSell,
      ornamentBuy: barBuy,
      ornamentSell: barSell,
      source: 'goldtraders.or.th',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchCurrentGoldPrice(): Promise<GoldPrice> {
  const sources = [fetchFromChnwt, fetchFromThaigold, fetchFromGoldtraders];

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
