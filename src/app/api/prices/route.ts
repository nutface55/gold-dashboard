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

// Get price history for Bollinger Band chart
export async function POST() {
  try {
    const history = await query<{
      timestamp: string;
      gold_bar_sell: number;
      gold_bar_buy: number;
    }>(
      `SELECT timestamp, gold_bar_sell, gold_bar_buy
       FROM price_history
       WHERE gold_bar_sell > 0
       ORDER BY timestamp DESC
       LIMIT 60`
    );

    return NextResponse.json(history.reverse());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
