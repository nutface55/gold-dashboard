import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { date_bought, weight, buy_price, notes, is_forever } = body;

    const lot = await queryOne(
      `UPDATE lots SET date_bought=$1, weight=$2, buy_price=$3, notes=$4, is_forever=$5
       WHERE id=$6 RETURNING *`,
      [date_bought, weight, buy_price, notes || null, is_forever || false, id]
    );

    if (!lot) return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    return NextResponse.json(lot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query(`DELETE FROM lots WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
