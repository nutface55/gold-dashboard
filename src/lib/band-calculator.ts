export interface BandData {
  sma: number;
  upperBand: number;
  lowerBand: number;
  stdDev: number;
  priceHistory: number[];
  daysOfData: number;
}

export interface BandPosition {
  sma: number;
  upperBand: number;
  lowerBand: number;
  currentPrice: number;
  percentAboveSma: number;        // positive = above, negative = below
  percentToUpperBand: number;     // negative = above upper band
  percentToLowerBand: number;     // positive = above lower band
  zone: 'strong_sell' | 'mild_sell' | 'hold' | 'hold_buy' | 'strong_buy';
  positionRatio: number;          // 0 = lower band, 0.5 = SMA, 1 = upper band
}

export function calculateBollingerBands(prices: number[], period = 20): BandData {
  if (prices.length < 2) {
    const p = prices[0] || 0;
    return {
      sma: p,
      upperBand: p * 1.04,
      lowerBand: p * 0.96,
      stdDev: p * 0.02,
      priceHistory: prices,
      daysOfData: prices.length,
    };
  }

  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((acc, p) => acc + Math.pow(p - sma, 2), 0) / slice.length;
  const stdDev = Math.sqrt(variance);

  return {
    sma: Math.round(sma),
    upperBand: Math.round(sma + 2 * stdDev),
    lowerBand: Math.round(sma - 2 * stdDev),
    stdDev: Math.round(stdDev),
    priceHistory: prices,
    daysOfData: prices.length,
  };
}

export function getBandPosition(currentPrice: number, bands: BandData): BandPosition {
  const { sma, upperBand, lowerBand } = bands;

  const percentAboveSma = ((currentPrice - sma) / sma) * 100;
  const percentToUpperBand = ((upperBand - currentPrice) / currentPrice) * 100;
  const percentToLowerBand = ((currentPrice - lowerBand) / currentPrice) * 100;

  // Zone logic from Rule 4
  let zone: BandPosition['zone'];
  if (currentPrice > upperBand) {
    zone = 'strong_sell';
  } else if (currentPrice > sma) {
    zone = 'mild_sell';
  } else if (currentPrice >= sma * 0.98) {
    zone = 'hold';
  } else if (currentPrice > lowerBand) {
    zone = 'hold_buy';
  } else {
    zone = 'strong_buy';
  }

  // Position ratio: 0 = lower band, 0.5 = SMA, 1 = upper band
  const range = upperBand - lowerBand;
  const positionRatio = range > 0 ? (currentPrice - lowerBand) / range : 0.5;

  return {
    sma,
    upperBand,
    lowerBand,
    currentPrice,
    percentAboveSma: Math.round(percentAboveSma * 10) / 10,
    percentToUpperBand: Math.round(percentToUpperBand * 10) / 10,
    percentToLowerBand: Math.round(percentToLowerBand * 10) / 10,
    zone,
    positionRatio: Math.max(0, Math.min(1, positionRatio)),
  };
}

// Generate synthetic price history when DB has insufficient data
// Uses weighted avg buy price and current price to extrapolate
export function generateSyntheticHistory(
  currentPrice: number,
  avgBuyPrice: number,
  days = 60
): number[] {
  const prices: number[] = [];
  const trend = (currentPrice - avgBuyPrice) / days;

  for (let i = days; i >= 0; i--) {
    const base = avgBuyPrice + trend * (days - i);
    // Add some noise (±2%)
    const noise = base * 0.02 * (Math.random() - 0.5);
    prices.push(Math.round(base + noise));
  }
  return prices;
}
