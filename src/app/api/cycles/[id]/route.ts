import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Delete buybacks first (foreign key), then refund cash, then delete cycle
    await query(`DELETE FROM cycle_buybacks WHERE cycle_id = $1`, [id]);

    // Get the cash that was generated so we can reverse it
    const cycle = await query<{ cash_generated: number; status: string }>(
      `SELECT cash_generated, status FROM cycles WHERE id = $1`, [id]
    );

    if (cycle.length > 0 && cycle[0].status === 'open') {
      // Deduct the pending cash from cash_state
      await query(
        `UPDATE cash_state SET amount = GREATEST(0, amount - $1), updated_at = NOW()
         WHERE id = (SELECT id FROM cash_state LIMIT 1)`,
        [cycle[0].cash_generated]
      );
    }

    await query(`DELETE FROM cycles WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
