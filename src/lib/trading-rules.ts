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
  tradableAvgBuyPrice: number;
  tradablePnlPercent: number;
  tradablePnlAmount: number;
  progressTo150: number;
  unrealisedProfitPerBaht: number;
  costToTarget: number;
  bricksToTarget: number;
}

export interface CashState {
  id?: number;
  amount: number;
  source_cycle_id?: number | null;
  updated_at?: string;
  sale_date?: string | null;
}

export interface ActionPlan {
  signal: 'strong_sell' | 'mild_sell' | 'hold' | 'buy_back' | 'mild_buy' | 'strong_buy' | 'cash_injection';
  headline: string;
  detail: string;
  mathVerification?: string;
  bestScenario?: BuybackScenario;
  rebuySummary?: string;        // sell→rebuy preview shown at point of sell decision
  daysSinceSale?: number;
  cashWarning?: boolean;
  injectionImpact?: ReturnType<typeof calculateInjectionImpact>;
}

export function computePortfolioMetrics(lots: Lot[], currentBuyPrice: number): PortfolioMetrics {
  const totalWeight = lots.reduce((s, l) => s + l.weight, 0);
  const totalInvested = lots.reduce((s, l) => s + l.weight * l.buy_price, 0);
  const avgBuyPrice = totalWeight > 0 ? Math.round(totalInvested / totalWeight) : 0;

  const currentValue = totalWeight * currentBuyPrice;
  const pnlAmount = currentValue - totalInvested;
  const pnlPercent = totalInvested > 0 ? (pnlAmount / totalInvested) * 100 : 0;

  const foreverWeight = lots
    .filter(l => isLockedLot(l, currentBuyPrice))
    .reduce((s, l) => s + l.weight, 0);

  const tradableLots = lots.filter(l => !isLockedLot(l, currentBuyPrice));
  const tradableWeight = tradableLots.reduce((s, l) => s + l.weight, 0);
  const tradableInvested = tradableLots.reduce((s, l) => s + l.weight * l.buy_price, 0);
  const tradableAvgBuyPrice = tradableWeight > 0 ? Math.round(tradableInvested / tradableWeight) : avgBuyPrice;
  const tradableValue = tradableWeight * currentBuyPrice;
  const tradablePnlAmount = tradableValue - tradableInvested;
  const tradablePnlPercent = tradableInvested > 0 ? Math.round((tradablePnlAmount / tradableInvested) * 1000) / 10 : 0;

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
    tradableWeight,
    tradableAvgBuyPrice,
    tradablePnlPercent,
    tradablePnlAmount,
    progressTo150: Math.round((totalWeight / 150) * 100),
    unrealisedProfitPerBaht,
    costToTarget,
    bricksToTarget,
  };
}

// Rule 1: Forever lots (P&L ≥ 40% — automatic, system-decided)
export function isForeverLot(lot: Lot, currentSellPrice: number): boolean {
  const pnl = ((currentSellPrice - lot.buy_price) / lot.buy_price) * 100;
  return pnl >= 40;
}

// A lot is locked if manually locked by user OR auto-forever by P&L rule
export function isLockedLot(lot: Lot, currentSellPrice: number): boolean {
  return lot.is_forever || isForeverLot(lot, currentSellPrice);
}

// Format avg change label: positive drop = ↓ (good), negative drop = ↑ (avg went up)
function avgChangeLabel(avgDrop: number): string {
  if (avgDrop > 0) return `↓฿${avgDrop.toLocaleString()}`;
  if (avgDrop < 0) return `↑฿${Math.abs(avgDrop).toLocaleString()}`;
  return 'no change';
}

// Build the sell→rebuy preview shown at point of sell decision
function buildRebuySummary(
  sellWeight: number,
  sellPrice: number,
  sma: number,
  lowerBand: number
): string {
  const cash = sellWeight * sellPrice;
  const rebuyAtSma = Math.floor(cash / sma / 5) * 5;
  const rebuyAtLower = Math.floor(cash / lowerBand / 5) * 5;
  const netAtSma = rebuyAtSma - sellWeight;
  const netAtLower = rebuyAtLower - sellWeight;

  return `💰 If you sell ${sellWeight}B at ฿${sellPrice.toLocaleString()} → ฿${cash.toLocaleString()} cash\n` +
    `  • Buy back at SMA (฿${sma.toLocaleString()}): get ${rebuyAtSma}B back → ${netAtSma >= 0 ? '+' : ''}${netAtSma}B net\n` +
    `  • Buy back at lower band (฿${lowerBand.toLocaleString()}): get ${rebuyAtLower}B back → ${netAtLower >= 0 ? '+' : ''}${netAtLower}B net\n` +
    `Goal: sell high → wait → buy back more gold than you sold.`;
}

export function generateActionPlan(
  bandPosition: BandPosition,
  portfolioMetrics: PortfolioMetrics,
  cashState: CashState | null,
  lots: Lot[],
  currentSellPrice: number
): ActionPlan {
  const { percentAboveSma, rsi, rsiReliable } = bandPosition;
  // Use tradable-only metrics so locked/forever lots don't distort signals
  const { tradablePnlPercent: pnlPercent, tradableAvgBuyPrice: avgBuyPrice } = portfolioMetrics;
  const hasCash = cashState && cashState.amount > 0;

  const rsiNote = rsiReliable
    ? rsi >= 70 ? `\n\n📈 RSI: ${rsi} — overbought, confirms sell signal.`
    : rsi <= 30 ? `\n\n📉 RSI: ${rsi} — oversold, confirms buy signal.`
    : `\n\n📊 RSI: ${rsi} — neutral, neither overbought nor oversold.`
    : `\n\n📊 RSI: Still building (needs 14+ days of real data).`;

  // ─── Priority 1: Cash in hand — find buy-back opportunity ───────────────
  if (hasCash && cashState) {
    const saleDate = cashState.sale_date ? new Date(cashState.sale_date) : null;
    const daysSinceSale = saleDate
      ? Math.floor((Date.now() - saleDate.getTime()) / 86400000)
      : 0;
    const cashWarning = daysSinceSale >= 30;

    const scenarios = calculateScenarios(
      bandPosition.currentPrice,
      bandPosition.sma,
      bandPosition.lowerBand,
      bandPosition.currentPrice
    ).filter(s => s.isViable && s.cashFromSale <= cashState.amount);

    if (scenarios.length > 0) {
      const best = scenarios[0];
      return {
        signal: 'buy_back',
        headline: `Buy back ${best.buybackWeight}B gold now — you'll end up with more than you sold`,
        detail: `You have ฿${cashState.amount.toLocaleString()} from your sale ${daysSinceSale} days ago. Gold has dropped enough — buy ${best.buybackBricks.map(b => `${b}B`).join(' + ')} at ฿${bandPosition.currentPrice.toLocaleString()} and you end up with ${best.netGoldGain > 0 ? `+${best.netGoldGain}B more gold` : 'the same gold back'} plus ฿${best.leftoverCash.toLocaleString()} leftover for the next cycle.\n\n📊 Technical: Price is near the SMA (20-day average ฿${bandPosition.sma.toLocaleString()}) — a historically reliable re-entry point.`,
        mathVerification: formatMathVerification(best),
        bestScenario: best,
        daysSinceSale,
        cashWarning,
      };
    }

    return {
      signal: 'buy_back',
      headline: `Hold your cash — price hasn't dropped enough yet`,
      detail: `You have ฿${cashState.amount.toLocaleString()} ready. Gold is still too high to buy back more bricks than you sold. Be patient — the goal is to end up with MORE gold, not the same amount.\n\n📊 Technical: Waiting for Tier 1 ฿${Math.round(bandPosition.currentPrice * 0.95).toLocaleString()} (−5%), Tier 2 ฿${bandPosition.sma.toLocaleString()} (SMA), or Tier 3 ฿${bandPosition.lowerBand.toLocaleString()} (lower Bollinger Band).`,
      daysSinceSale,
      cashWarning,
    };
  }

  // ─── Priority 2: SELL signals (tightened thresholds) ────────────────────

  // Strong sell: above upper band + P&L ≥ 15%
  if (bandPosition.zone === 'strong_sell' && pnlPercent >= 15) {
    const scenarios = calculateScenarios(bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand);
    const best = scenarios.find(s => s.isViable && s.sellWeight === 10);
    const dropToSma = Math.round((1 - bandPosition.sma / bandPosition.currentPrice) * 100);
    return {
      signal: 'strong_sell',
      headline: 'Sell a 10B brick — gold is at an unusually high price',
      detail: `Gold has pushed above its normal range. This is the clearest sell signal — prices this high don't last. Sell now, collect the cash, and wait to buy back more bricks when it comes back down.\n\n📊 Technical: Price is above the upper Bollinger Band — statistically stretched. Portfolio P&L is ${pnlPercent.toFixed(1)}%. Expected to drop ~${dropToSma}% back toward SMA (฿${bandPosition.sma.toLocaleString()}).${rsiNote}`,
      mathVerification: best ? formatMathVerification(best) : undefined,
      bestScenario: best,
      rebuySummary: buildRebuySummary(10, bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand),
    };
  }

  // Mild sell: above SMA by ≥ 4% + P&L ≥ 12%
  if (percentAboveSma >= 4 && pnlPercent >= 12) {
    const scenarios = calculateScenarios(bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand);
    const best = scenarios.find(s => s.isViable && s.sellWeight === 5);
    return {
      signal: 'mild_sell',
      headline: 'Consider selling a 5B brick — price is meaningfully above average',
      detail: `Gold is ${percentAboveSma.toFixed(1)}% above its 20-day average — high enough to be worth acting on. Selling a 5B brick now and buying back when it cools down is a solid move. Not urgent, but worth doing.\n\n📊 Technical: Price is ${percentAboveSma.toFixed(1)}% above SMA (฿${bandPosition.sma.toLocaleString()}). Mild sell threshold: 4% above SMA with P&L ≥ 12%. Current P&L: ${pnlPercent.toFixed(1)}%.${rsiNote}`,
      mathVerification: best ? formatMathVerification(best) : undefined,
      bestScenario: best,
      rebuySummary: buildRebuySummary(5, bandPosition.currentPrice, bandPosition.sma, bandPosition.lowerBand),
    };
  }

  // ─── Priority 3: BUY signals (tiered) ────────────────────────────────────

  // Strong buy: price at least 1% below tradable avg cost OR within 2% of lower band
  // (1% gap avoids triggering on noise when price ≈ avg cost)
  const distToLower = ((bandPosition.currentPrice - bandPosition.lowerBand) / bandPosition.currentPrice) * 100;
  const meaningfullyBelowAvg = bandPosition.currentPrice < avgBuyPrice * 0.99;
  if (meaningfullyBelowAvg || distToLower <= 2) {
    // Use blended avgBuyPrice + totalWeight for accurate portfolio avg after injection
    const impact10 = calculateInjectionImpact(portfolioMetrics.tradableWeight, portfolioMetrics.tradableAvgBuyPrice, 10, bandPosition.currentPrice);
    const impact5 = calculateInjectionImpact(portfolioMetrics.tradableWeight, portfolioMetrics.tradableAvgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'strong_buy',
      headline: bandPosition.currentPrice < avgBuyPrice
        ? 'Strong buy — gold is cheaper than your average cost'
        : 'Strong buy — gold is near its recent low',
      detail: `${bandPosition.currentPrice < avgBuyPrice
        ? `Gold is ฿${(avgBuyPrice - bandPosition.currentPrice).toLocaleString()} below what you paid on average. Every baht you buy now brings your total cost down significantly.`
        : `Gold is right at the bottom of its normal range — historically this is where it bounces back up.`
      } Stack as hard as you can here.\n\n📊 Technical: ${bandPosition.currentPrice < avgBuyPrice ? `Price (฿${bandPosition.currentPrice.toLocaleString()}) is below your avg buy price (฿${avgBuyPrice.toLocaleString()}) — strong accumulation signal.` : `Price is within 2% of the lower Bollinger Band (฿${bandPosition.lowerBand.toLocaleString()}) — statistically oversold.`}\n\n• Add 5B → new avg: ฿${impact5.newAvgBuyPrice.toLocaleString()} (${avgChangeLabel(impact5.avgDrop)}/baht)\n• Add 10B → new avg: ฿${impact10.newAvgBuyPrice.toLocaleString()} (${avgChangeLabel(impact10.avgDrop)}/baht)${rsiNote}`,
      injectionImpact: impact5,
    };
  }

  // Mild buy: price below SMA by ≥ 3%
  if (percentAboveSma <= -3) {
    const impact5 = calculateInjectionImpact(portfolioMetrics.tradableWeight, portfolioMetrics.tradableAvgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'mild_buy',
      headline: 'Good entry point — gold is below its recent average',
      detail: `Gold is ${Math.abs(percentAboveSma).toFixed(1)}% below its 20-day average price. Not the lowest it can go, but a solid entry if you have spare cash. No rush — but better to buy here than when it's back above average.\n\n📊 Technical: Price is ${Math.abs(percentAboveSma).toFixed(1)}% below SMA (฿${bandPosition.sma.toLocaleString()}). Mild buy threshold: 3% below SMA.\n\n• Add 5B → new avg: ฿${impact5.newAvgBuyPrice.toLocaleString()} (${avgChangeLabel(impact5.avgDrop)}/baht)${rsiNote}`,
      injectionImpact: impact5,
    };
  }

  // Mild buy: price below SMA by 1-3% — decent entry
  if (percentAboveSma <= -1) {
    const impact5 = calculateInjectionImpact(portfolioMetrics.tradableWeight, portfolioMetrics.tradableAvgBuyPrice, 5, bandPosition.currentPrice);
    return {
      signal: 'mild_buy',
      headline: 'Decent entry — gold is slightly below average',
      detail: `Gold is slightly cheaper than its recent average. If you have extra cash sitting idle, this is a reasonable time to put it to work. Not urgent.\n\n📊 Technical: Price is ${Math.abs(percentAboveSma).toFixed(1)}% below SMA (฿${bandPosition.sma.toLocaleString()}).\n\n• Add 5B → new avg: ฿${impact5.newAvgBuyPrice.toLocaleString()} (${avgChangeLabel(impact5.avgDrop)}/baht)${rsiNote}`,
      injectionImpact: impact5,
    };
  }

  // ─── Default: Hold ────────────────────────────────────────────────────────
  return {
    signal: 'hold',
    headline: 'Do nothing — gold is fairly priced right now',
    detail: `Gold is in the middle of its normal range — ${Math.abs(percentAboveSma).toFixed(1)}% ${percentAboveSma >= 0 ? 'above' : 'below'} its 20-day average. Not cheap enough to rush to buy, not expensive enough to sell. Hold and wait for a clearer move.\n\n📊 Technical: SMA ฿${bandPosition.sma.toLocaleString()} | Upper band ฿${bandPosition.upperBand.toLocaleString()} | Lower band ฿${bandPosition.lowerBand.toLocaleString()} | Portfolio P&L: ${pnlPercent.toFixed(1)}%.${rsiNote}`,
  };
}
