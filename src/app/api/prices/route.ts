import { NextResponse } from 'next/server';
import { fetchCurrentGoldPrice } from '@/lib/price-fetcher';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const price = await fetchCurrentGoldPrice();

    // Save to price_history if DB is available
    if (price.barBuy > 0) {
      try {
        await query(
          `INSERT INTO price_history (source, gold_bar_buy, gold_bar_sell, gold_ornament_buy, gold_ornament_sell)
           VALUES ($1, $2, $3, $4, $5)`,
          [price.source, price.barBuy, price.barSell, price.ornamentBuy, price.ornamentSell]
        );
      } catch {
        // DB not ready yet — ignore
      }
    }

    return NextResponse.json(price);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Get price history — one price per calendar day (Bangkok time).
// No limit: full history is needed for signal backtesting (500+ days).
// Bollinger Bands use slice(-20) internally so extra rows don't affect them.
export async function POST() {
  try {
    const history = await query<{
      timestamp: string;
      gold_bar_sell: number;
      gold_bar_buy: number;
    }>(
      `SELECT
         MAX(timestamp) AS timestamp,
         ROUND(AVG(gold_bar_sell))::integer AS gold_bar_sell,
         ROUND(AVG(gold_bar_buy))::integer  AS gold_bar_buy
       FROM price_history
       WHERE gold_bar_sell > 0
       GROUP BY DATE(timestamp AT TIME ZONE 'Asia/Bangkok')
       ORDER BY DATE(timestamp AT TIME ZONE 'Asia/Bangkok') ASC`
    );

    return NextResponse.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
