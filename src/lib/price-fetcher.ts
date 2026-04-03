import axios from 'axios';

export interface GoldPrice {
  barBuy: number;    // shop sells to you (you buy at this price)
  barSell: number;   // shop buys from you (you sell at this price)
  ornamentBuy: number;
  ornamentSell: number;
  source: string;
  timestamp: string;
  raw?: unknown;
}

// Primary: thaigold.info direct JSON
async function fetchFromThaigold(): Promise<GoldPrice | null> {
  try {
    const { data } = await axios.get('http://www.thaigold.info/RealTimeDataV2/gtdata_.json', {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    // The JSON has an array; first item is usually the current price
    // Fields: BuyBarPrice, SellBarPrice, BuyOrnamentPrice, SellOrnamentPrice
    const item = Array.isArray(data) ? data[0] : data;
    const barBuy = parseFloat(item?.BuyBarPrice || item?.buyBarPrice || 0);
    const barSell = parseFloat(item?.SellBarPrice || item?.sellBarPrice || 0);
    const ornBuy = parseFloat(item?.BuyOrnamentPrice || item?.buyOrnamentPrice || 0);
    const ornSell = parseFloat(item?.SellOrnamentPrice || item?.sellOrnamentPrice || 0);

    if (!barBuy || !barSell) return null;

    return {
      barBuy,
      barSell,
      ornamentBuy: ornBuy,
      ornamentSell: ornSell,
      source: 'thaigold.info',
      timestamp: new Date().toISOString(),
      raw: item,
    };
  } catch {
    return null;
  }
}

// Secondary: community API (chnwt.dev)
async function fetchFromChnwt(): Promise<GoldPrice | null> {
  try {
    const { data } = await axios.get('https://api.chnwt.dev/thai-gold-api/latest', {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    // Response: { data: { price: { bar: { buy, sell }, ornament: { buy, sell } } } }
    const price = data?.data?.price || data?.price;
    const bar = price?.bar || price?.['96.5'];
    const orn = price?.ornament || price?.['96.5_ornament'];

    const barBuy = parseFloat(bar?.buy || bar?.sell_price || 0);
    const barSell = parseFloat(bar?.sell || bar?.buy_price || 0);
    const ornBuy = parseFloat(orn?.buy || 0);
    const ornSell = parseFloat(orn?.sell || 0);

    if (!barBuy || !barSell) return null;

    return {
      barBuy,
      barSell,
      ornamentBuy: ornBuy,
      ornamentSell: ornSell,
      source: 'api.chnwt.dev',
      timestamp: new Date().toISOString(),
      raw: data,
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

    // Try to find price elements
    $('td, span, div').each((_, el) => {
      const text = $(el).text().trim().replace(/,/g, '');
      const num = parseFloat(text);
      if (num > 50000 && num < 200000) {
        prices.push(num);
      }
    });

    if (prices.length < 2) return null;

    // Sort and pick the reasonable ones
    const sorted = [...new Set(prices)].sort((a, b) => a - b);
    const barSell = sorted[0];  // lower = shop buys from you
    const barBuy = sorted[1] || sorted[0] + 300;  // higher = shop sells to you

    return {
      barBuy,
      barSell,
      ornamentBuy: barBuy - 500,
      ornamentSell: barSell,
      source: 'goldtraders.or.th',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchCurrentGoldPrice(): Promise<GoldPrice> {
  // Try sources in order
  const sources = [fetchFromThaigold, fetchFromChnwt, fetchFromGoldtraders];

  for (const fetchFn of sources) {
    const result = await fetchFn();
    if (result && result.barBuy > 0 && result.barSell > 0) {
      return result;
    }
  }

  // If all fail, return a placeholder
  return {
    barBuy: 0,
    barSell: 0,
    ornamentBuy: 0,
    ornamentSell: 0,
    source: 'unavailable',
    timestamp: new Date().toISOString(),
  };
}
