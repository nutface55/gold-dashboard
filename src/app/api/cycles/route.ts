import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    const cycles = await query(
      `SELECT c.*,
        COALESCE(json_agg(cb.*) FILTER (WHERE cb.id IS NOT NULL), '[]') as buybacks
       FROM cycles c
       LEFT JOIN cycle_buybacks cb ON cb.cycle_id = c.id
       GROUP BY c.id
       ORDER BY c.sell_date DESC`
    );
    return NextResponse.json(cycles);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sell_date, sell_weight, sell_price } = body;

    const cash_generated = Math.round(sell_weight * sell_price);

    const cycle = await queryOne(
      `INSERT INTO cycles (sell_date, sell_weight, sell_price, cash_generated, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [sell_date, sell_weight, sell_price, cash_generated]
    );

    // Update cash_state
    await query(
      `UPDATE cash_state SET amount = amount + $1, source_cycle_id = $2, sale_date = $3, updated_at = NOW()
       WHERE id = (SELECT id FROM cash_state LIMIT 1)`,
      [cash_generated, (cycle as { id: number })?.id, sell_date]
    );

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
