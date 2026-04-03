import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    const lots = await query(
      `SELECT * FROM lots ORDER BY date_bought ASC`
    );
    return NextResponse.json(lots);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date_bought, weight, buy_price, notes } = body;

    if (!date_bought || !weight || !buy_price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lot = await queryOne(
      `INSERT INTO lots (date_bought, weight, buy_price, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [date_bought, weight, buy_price, notes || null]
    );

    return NextResponse.json(lot, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
