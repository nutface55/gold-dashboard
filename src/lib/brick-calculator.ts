export type BrickSize = 5 | 10;

export interface BuybackScenario {
  sellWeight: BrickSize;
  sellPrice: number;
  cashFromSale: number;
  buybackWeight: number;      // total baht bought back
  buybackBricks: BrickSize[]; // e.g. [10, 5] = one 10B + one 5B
  buybackPrice: number;       // actual price used for the buyback
  buybackCost: number;
  leftoverCash: number;
  netGoldGain: number;        // buybackWeight - sellWeight (can be 0 or positive)
  isViable: boolean;          // netGoldGain > 0 or at minimum breaks even
  label: string;
}

export interface BuybackTiers {
  tier1Price: number;   // 5% below sell price — buy 5B
  tier2Price: number;   // at SMA — buy 5B or 10B
  tier3Price: number;   // lower band or 10% below sell — buy remainder
  sellPrice: number;
}

export function calculateBuybackTiers(sellPrice: number, sma: number, lowerBand: number): BuybackTiers {
  return {
    sellPrice,
    tier1Price: Math.round(sellPrice * 0.95),
    tier2Price: sma,
    tier3Price: Math.max(lowerBand, Math.round(sellPrice * 0.90)),
  };
}

// Calculate all sell→buy scenarios
export function calculateScenarios(
  currentPrice: number,
  sma: number,
  lowerBand: number,
  sellPrice?: number  // if cash in hand, use that sell price
): BuybackScenario[] {
  const effectiveSellPrice = sellPrice || currentPrice;
  const scenarios: BuybackScenario[] = [];

  const sellWeights: BrickSize[] = [5, 10];
  const targetDrops = [0.95, sma / effectiveSellPrice, lowerBand / effectiveSellPrice, 0.90];

  for (const sellWeight of sellWeights) {
    const cashFromSale = sellWeight * effectiveSellPrice;

    for (const dropFactor of targetDrops) {
      const buybackPrice = Math.round(effectiveSellPrice * dropFactor);
      if (buybackPrice <= 0) continue;

      // How many whole bricks can we buy?
      const maxBaht = Math.floor(cashFromSale / buybackPrice);

      // Round down to nearest 5
      const buybackWeight = Math.floor(maxBaht / 5) * 5;

      if (buybackWeight === 0) continue;

      // Decompose into bricks (prefer 10B then 5B)
      const bricks: BrickSize[] = [];
      let remaining = buybackWeight;
      while (remaining >= 10) {
        bricks.push(10);
        remaining -= 10;
      }
      if (remaining === 5) bricks.push(5);

      const buybackCost = buybackWeight * buybackPrice;
      const leftoverCash = cashFromSale - buybackCost;
      const netGoldGain = buybackWeight - sellWeight;

      const dropPct = Math.round((1 - dropFactor) * 100);
      const label = `Sell ${sellWeight}B → Buy @${dropPct}% drop (฿${buybackPrice.toLocaleString()})`;

      scenarios.push({
        sellWeight,
        sellPrice: effectiveSellPrice,
        cashFromSale,
        buybackWeight,
        buybackBricks: bricks,
        buybackPrice,
        buybackCost,
        leftoverCash,
        netGoldGain,
        isViable: netGoldGain > 0,
        label,
      });
    }
  }

  // Sort by viability then by net gold gain desc
  return scenarios.sort((a, b) => {
    if (a.isViable !== b.isViable) return a.isViable ? -1 : 1;
    return b.netGoldGain - a.netGoldGain;
  });
}

// Format math verification string (Rule 8)
export function formatMathVerification(scenario: BuybackScenario): string {
  const bp = scenario.buybackPrice;
  const lines = [
    `Sell: ${scenario.sellWeight}B × ฿${scenario.sellPrice.toLocaleString()} = ฿${scenario.cashFromSale.toLocaleString()}`,
    `Buy back at ฿${bp.toLocaleString()}: ฿${scenario.cashFromSale.toLocaleString()} ÷ ฿${bp.toLocaleString()} = ${(scenario.cashFromSale / bp).toFixed(2)} baht`,
    `→ ${scenario.buybackBricks.map(b => `${b}B`).join(' + ')} = ${scenario.buybackWeight}B (cost ฿${scenario.buybackCost.toLocaleString()})`,
    `→ Leftover: ฿${scenario.leftoverCash.toLocaleString()}`,
    `→ Net: sold ${scenario.sellWeight}B, got ${scenario.buybackWeight}B back + ฿${scenario.leftoverCash.toLocaleString()} toward next brick`,
    `✓ Verified: ${scenario.buybackWeight}B × ฿${bp.toLocaleString()} = ฿${scenario.buybackCost.toLocaleString()}. ฿${scenario.cashFromSale.toLocaleString()} - ฿${scenario.buybackCost.toLocaleString()} = ฿${scenario.leftoverCash.toLocaleString()}. Correct.`,
  ];
  return lines.join('\n');
}

// Calculate impact of cash injection (Rule 6)
export function calculateInjectionImpact(
  currentWeight: number,
  currentAvgBuyPrice: number,
  injectionWeight: BrickSize,
  injectionPrice: number
): { newWeight: number; newAvgBuyPrice: number; avgDrop: number } {
  const currentCost = currentWeight * currentAvgBuyPrice;
  const injectionCost = injectionWeight * injectionPrice;
  const newWeight = currentWeight + injectionWeight;
  const newAvgBuyPrice = Math.round((currentCost + injectionCost) / newWeight);
  return {
    newWeight,
    newAvgBuyPrice,
    avgDrop: currentAvgBuyPrice - newAvgBuyPrice,
  };
}
