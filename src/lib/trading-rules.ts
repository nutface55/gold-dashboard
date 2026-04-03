import { BandPosition } from './band-calculator';
import { calculateScenarios, BuybackScenario, formatMathVerification, calculateInjectionImpact } from './brick-calculator';

export interface Lot {
  id: number;
  date_bought: string;
  weight: number;
  buy_price: number;
  notes: string | null;
  is_forever: boolean;
}

export interface PortfolioMetrics {
  totalWeight: number;
  totalInvested: number;
  avgBuyPrice: number;
  currentValue: number;
  pnlAmount: number;
  pnlPercent: number;
  foreverWeight: number;
  tradableWeight: number;
  progressTo150: number;
  unrealisedProfitPerBaht: number; // profit per baht weight at current price
  costToTarget: number;            // cash needed to reach 150B at current price
  bricksToTarget: number;          // how many baht of gold still needed
}

export interface CashState {
  id?: number;
  amount: number;
  source_cycle_id?: number | null;
  updated_at?: string;
  sale_date?: string | null;
}

export interface ActionPlan {
  signal: 'strong_sell' | 'mild_sell' | 'hold' | 'buy_back' | 'cash_injection' | 'hold_buy';
  headline: string;
  detail: string;
  mathVerification?: string;
  bestScenario?: BuybackScenario;
  daysSinceSale?: number;
  cashWarning?: boolean;
  injectionImpact?: ReturnType<typeof calculateInjectionImpact>;
}

export function computePortfolioMetrics(lots: Lot[], currentBuyPrice: number): PortfolioMetrics {
  const totalWeight = lots.reduce((s, l) => s + l.weight, 0);
  const totalInvested = lots.reduce((s, l) => s + l.weight * l.buy_price, 0);
  const avgBuyPrice = totalWeight > 0 ? Math.round(totalInvested / totalWeight) : 0;

  // Current value at bar sell price (what the shop pays you)
  const currentValue = totalWeight * currentBuyPrice;
  const pnlAmount = currentValue - totalInvested;
  const pnlPercent = totalInvested > 0 ? (pnlAmount / totalInvested) * 100 : 0;

  const foreverWeight = lots
    .filter(l => isForeverLot(l, currentBuyPrice))
    .reduce((s, l) => s + l.weight, 0);

  const bricksToTarget = Math.max(0, 150 - totalWeight);
  const costToTarget = bricksToTarget * currentBuyPrice;
  const unrealisedProfitPerBaht = currentBuyPrice - avgBuyPrice;

  return {
    totalWeight,
    totalInvested,
    avgBuyPrice,
    currentValue,
    pnlAmount,
    pnlPercent: Math.round(pnlPercent * 10) / 10,
    foreverWeight,
    tradableWeight: totalWeight - foreverWeight,
    progressTo150: Math.round((totalWeight / 150) * 100),
    unrealisedProfitPerBaht,
    costToTarget,
    bricksToTarget,
  };
}

// Rule 1: Forever lots (P&L ≥ 40%)
export function isForeverLot(lot: Lot, currentSellPrice: number): boolean {
  const pnl = ((currentSellPrice - lot.buy_price) / lot.buy_price) * 100;
  return pnl >= 40;
}

// Rule 4 + all rules → Action Plan
export function generateActionPlan(
  bandPosition: BandPosition,
  portfolioMetrics: PortfolioMetrics,
  cashState: CashState | null,
  lots: Lot[],
  currentSellPrice: number
): ActionPlan {
  const { zone } = bandPosition;
  const { pnlPercent, avgBuyPrice } = portfolioMetrics;
  const hasCash = cashState && cashState.amount > 0;

  // Priority 1: If we have cash, check buy-back triggers
  if (hasCash && cashState) {
    const saleDate = cashState.sale_date ? new Date(cashState.sale_date) : null;
    const daysSinceSale = saleDate
      ? Math.floor((Date.now() - saleDate.getTime()) / 86400000)
      : 0;

    const scenarios = calculateScenarios(
      bandPosition.currentPrice,
      bandPosition.sma,
      bandPosition.lowerBand,
      bandPosition.currentPrice
    ).filter(s => s.isViable && s.cashFromSale <= cashState.amount);

    const cashWarning = daysSinceSale >= 30;

    if (scenarios.length > 0) {
      const best = scenarios[0];
      return {
        signal: 'buy_back',
        headline: `Buy back ${best.buybackWeight}B gold now`,
        detail: `You have ฿${cashState.amount.toLocaleString()} sitting from your sale ${daysSinceSale} days ago. Gold has dropped enough — buy ${best.buybackBricks.map(b => `${b}B`).join(' + ')} at ฿${bandPosition.currentPrice.toLocaleString()} and you'll end up with more gold than you sold.\n\n📊 Technical: Price is near the SMA (20-day average price) — historically a good re-entry point.`,
        mathVerification: formatMathVerification(best, bandPosition.currentPrice),
        bestScenario: best,
        daysSinceSale,
        cashWarning,
      };
    }

    return {
      signal: 'buy_back',
      headline: `Hold your cash — waiting for a better price`,
      detail: `You have ฿${cashState.amount.toLocaleString()} ready. Gold hasn't dropped enough yet to buy back more than you sold. Be patient.\n\n📊 Technical: Waiting for price to reach Tier 1 ฿${Math.round(bandPosition.currentPrice * 0.95).toLocaleString()} (−5%), Tier 2 ฿${bandPosition.sma.toLocaleString()} (SMA / 20-day average), or Tier 3 ฿${bandPosition.lowerBand.toLocaleString()} (lower Bollinger Band).`,
      daysSinceSale,
      cashWarning,
    };
  }

  // Priority 2: Sell signals (Rule 4)
  if (zone === 'strong_sell' && pnlPercent >= 15) {
    const scenarios = calculateScenarios(bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand);
    const best = scenarios.find(s => s.isViable && s.sellWeight === 10);
    const dropToSma = Math.round((1 - bandPosition.sma / bandPosition.currentPrice) * 100);
    return {
      signal: 'strong_sell',
      headline: 'Sell a 10B brick — gold is expensive right now',
      detail: `Gold is at a recent high. If you sell now at ฿${bandPosition.currentPrice.toLocaleString()} and wait for it to drop back down, you can buy back more gold than you sold — ending up with a bigger pile for free.\n\n📊 Technical: Price is above the upper Bollinger Band (unusually high vs. the last 20 days) and portfolio P&L is ${pnlPercent.toFixed(1)}%. A drop of ~${dropToSma}% back to the 20-day average (฿${bandPosition.sma.toLocaleString()}) is expected.`,
      mathVerification: best ? formatMathVerification(best, bandPosition.sma) : undefined,
      bestScenario: best,
    };
  }

  if ((zone === 'strong_sell' || zone === 'mild_sell') && pnlPercent >= 10) {
    const scenarios = calculateScenarios(bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand);
    const best = scenarios.find(s => s.isViable && s.sellWeight === 5);
    return {
      signal: 'mild_sell',
      headline: 'Consider selling a 5B brick — price is above average',
      detail: `Gold is a little above its recent average price. Not a screaming sell, but selling a 5B brick now and waiting to buy back cheaper could get you more gold.\n\n📊 Technical: Price is ${bandPosition.percentAboveSma.toFixed(1)}% above the SMA (20-day average ฿${bandPosition.sma.toLocaleString()}). Portfolio profit is ${pnlPercent.toFixed(1)}%.`,
      mathVerification: best ? formatMathVerification(best, bandPosition.sma) : undefined,
      bestScenario: best,
    };
  }

  // Priority 3: Cash injection (Rule 6)
  if (zone === 'strong_buy' || bandPosition.currentPrice < avgBuyPrice) {
    const impact5 = calculateInjectionImpact(portfolioMetrics.totalWeight, avgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'cash_injection',
      headline: 'Good time to buy more gold with fresh cash',
      detail: `Gold is ${bandPosition.currentPrice < avgBuyPrice ? `฿${(avgBuyPrice - bandPosition.currentPrice).toLocaleString()} cheaper than your average purchase price` : 'near its recent low'}. Buying a 5B brick now at ฿${bandPosition.currentPrice.toLocaleString()} would bring your average cost down from ฿${avgBuyPrice.toLocaleString()} to ฿${impact5.newAvgBuyPrice.toLocaleString()} — saving ฿${impact5.avgDrop.toLocaleString()} per baht.\n\n📊 Technical: Price is ${bandPosition.currentPrice < avgBuyPrice ? 'below your portfolio average (strong accumulation signal)' : 'near the lower Bollinger Band — historically a bounce zone'}.`,
      injectionImpact: impact5,
    };
  }

  if (zone === 'hold_buy') {
    const impact5 = calculateInjectionImpact(portfolioMetrics.totalWeight, avgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'hold_buy',
      headline: 'Hold — but worth buying if you have spare cash',
      detail: `Gold is below its recent average — not the lowest it's been, but decent value. If you have cash available, a 5B brick at ฿${bandPosition.currentPrice.toLocaleString()} would pull your average cost down to ฿${impact5.newAvgBuyPrice.toLocaleString()}.\n\n📊 Technical: Price is below the SMA (20-day average ฿${bandPosition.sma.toLocaleString()}) — meaning gold is cheaper than it has been recently.`,
      injectionImpact: impact5,
    };
  }

  // Default: Hold
  return {
    signal: 'hold',
    headline: 'Do nothing — gold is fairly priced right now',
    detail: `Gold is sitting in the middle of its normal range — not cheap enough to rush to buy, not expensive enough to sell. Just hold and wait for a clearer move.\n\n📊 Technical: Price is ${bandPosition.percentAboveSma > 0 ? `${bandPosition.percentAboveSma.toFixed(1)}% above` : `${Math.abs(bandPosition.percentAboveSma).toFixed(1)}% below`} the SMA (20-day average ฿${bandPosition.sma.toLocaleString()}). Portfolio profit: ${pnlPercent.toFixed(1)}%.`,
  };
}
