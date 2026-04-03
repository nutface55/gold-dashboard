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
        headline: `Buy back ${best.buybackWeight}B gold — buy-back triggered`,
        detail: `You have ฿${cashState.amount.toLocaleString()} cash from a sale ${daysSinceSale} days ago. Buy ${best.buybackBricks.map(b => `${b}B`).join(' + ')} at current price ฿${bandPosition.currentPrice.toLocaleString()}.`,
        mathVerification: formatMathVerification(best, bandPosition.currentPrice),
        bestScenario: best,
        daysSinceSale,
        cashWarning,
      };
    }

    // Cash exists but no good buy-back scenario yet
    return {
      signal: 'buy_back',
      headline: `Waiting for dip — ฿${cashState.amount.toLocaleString()} cash ready`,
      detail: `Day ${daysSinceSale} of 30. Target prices: Tier 1 ฿${Math.round(bandPosition.currentPrice * 0.95).toLocaleString()}, Tier 2 ฿${bandPosition.sma.toLocaleString()} (SMA), Tier 3 ฿${bandPosition.lowerBand.toLocaleString()} (lower band).`,
      daysSinceSale,
      cashWarning,
    };
  }

  // Priority 2: Sell signals (Rule 4)
  if (zone === 'strong_sell' && pnlPercent >= 15) {
    const scenarios = calculateScenarios(bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand);
    const best = scenarios.find(s => s.isViable && s.sellWeight === 10);
    return {
      signal: 'strong_sell',
      headline: 'Sell a 10B brick today — strong sell signal',
      detail: `Price is ${bandPosition.percentAboveSma.toFixed(1)}% above SMA and above upper Bollinger Band. Portfolio P&L: ${pnlPercent.toFixed(1)}%. Sell now and wait for a ${Math.round((1 - bandPosition.sma / bandPosition.currentPrice) * 100)}% dip to buy back more.`,
      mathVerification: best ? formatMathVerification(best, bandPosition.sma) : undefined,
      bestScenario: best,
    };
  }

  if ((zone === 'strong_sell' || zone === 'mild_sell') && pnlPercent >= 10) {
    const scenarios = calculateScenarios(bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand);
    const best = scenarios.find(s => s.isViable && s.sellWeight === 5);
    return {
      signal: 'mild_sell',
      headline: 'Sell a 5B brick — mild sell signal',
      detail: `Price is ${bandPosition.percentAboveSma.toFixed(1)}% above SMA. Portfolio P&L: ${pnlPercent.toFixed(1)}%. Consider selling a 5B brick.`,
      mathVerification: best ? formatMathVerification(best, bandPosition.sma) : undefined,
      bestScenario: best,
    };
  }

  // Priority 3: Cash injection (Rule 6)
  if (zone === 'strong_buy' || bandPosition.currentPrice < avgBuyPrice) {
    const impact5 = calculateInjectionImpact(portfolioMetrics.totalWeight, avgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'cash_injection',
      headline: 'Consider buying more — strong buy zone',
      detail: `Price (฿${bandPosition.currentPrice.toLocaleString()}) is ${bandPosition.currentPrice < avgBuyPrice ? `฿${(avgBuyPrice - bandPosition.currentPrice).toLocaleString()} BELOW` : 'near'} your avg buy price (฿${avgBuyPrice.toLocaleString()}). Adding a 5B brick would drop your avg to ฿${impact5.newAvgBuyPrice.toLocaleString()} (↓฿${impact5.avgDrop.toLocaleString()}).`,
      injectionImpact: impact5,
    };
  }

  if (zone === 'hold_buy') {
    const impact5 = calculateInjectionImpact(portfolioMetrics.totalWeight, avgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'hold_buy',
      headline: 'Hold — consider cash injection if available',
      detail: `Price is below SMA. A 5B brick injection at ฿${bandPosition.currentPrice.toLocaleString()} would drop your avg to ฿${impact5.newAvgBuyPrice.toLocaleString()}.`,
      injectionImpact: impact5,
    };
  }

  // Default: Hold
  return {
    signal: 'hold',
    headline: 'Hold — price is mid-range, no action needed',
    detail: `Price is ${bandPosition.percentAboveSma > 0 ? `${bandPosition.percentAboveSma.toFixed(1)}% above` : `${Math.abs(bandPosition.percentAboveSma).toFixed(1)}% below`} SMA. Portfolio P&L: ${pnlPercent.toFixed(1)}%. Wait for a clearer signal.`,
  };
}
