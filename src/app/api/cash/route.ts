import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    const state = await queryOne(
      `SELECT * FROM cash_state ORDER BY id LIMIT 1`
    );
    return NextResponse.json(state || { amount: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Record a buy-back
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buy_date, buy_weight, buy_price, cycle_id } = body;

    const cash_spent = buy_weight * buy_price;

    // Insert buyback record
    if (cycle_id) {
      await query(
        `INSERT INTO cycle_buybacks (cycle_id, buy_date, buy_weight, buy_price, cash_spent)
         VALUES ($1, $2, $3, $4, $5)`,
        [cycle_id, buy_date, buy_weight, buy_price, cash_spent]
      );
    }

    // Add to lots
    await query(
      `INSERT INTO lots (date_bought, weight, buy_price, notes)
       VALUES ($1, $2, $3, 'Buy-back')`,
      [buy_date, buy_weight, buy_price]
    );

    // Reduce cash
    await query(
      `UPDATE cash_state SET amount = GREATEST(0, amount - $1), updated_at = NOW()
       WHERE id = (SELECT id FROM cash_state LIMIT 1)`,
      [cash_spent]
    );

    // Check if cycle is now closed (cash depleted)
    const cashState = await queryOne<{ amount: number }>(
      `SELECT amount FROM cash_state LIMIT 1`
    );

    if (cycle_id && cashState && cashState.amount === 0) {
      await query(
        `UPDATE cycles SET status='closed' WHERE id=$1`,
        [cycle_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Update cash manually
export async function PUT(req: NextRequest) {
  try {
    const { amount, sale_date } = await req.json();
    const state = await queryOne(
      `UPDATE cash_state SET amount=$1, sale_date=$2, updated_at=NOW()
       WHERE id=(SELECT id FROM cash_state LIMIT 1)
       RETURNING *`,
      [amount, sale_date || null]
    );
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
