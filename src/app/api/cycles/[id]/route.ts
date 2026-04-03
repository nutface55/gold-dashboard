import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Delete buybacks first
    await query(`DELETE FROM cycle_buybacks WHERE cycle_id = $1`, [id]);

    // Get cycle info to reverse cash if still open
    const cycle = await query<{ cash_generated: number; status: string }>(
      `SELECT cash_generated, status FROM cycles WHERE id = $1`, [id]
    );

    if (cycle.length > 0 && cycle[0].status === 'open') {
      await query(
        `UPDATE cash_state SET amount = GREATEST(0, amount - $1), source_cycle_id = NULL, sale_date = NULL, updated_at = NOW()
         WHERE id = (SELECT id FROM cash_state LIMIT 1)`,
        [cycle[0].cash_generated]
      );
    }

    // Clear foreign key reference in cash_state before deleting cycle
    await query(
      `UPDATE cash_state SET source_cycle_id = NULL WHERE source_cycle_id = $1`, [id]
    );

    await query(`DELETE FROM cycles WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
