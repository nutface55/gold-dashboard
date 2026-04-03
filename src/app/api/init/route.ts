import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lots (
  id SERIAL PRIMARY KEY,
  date_bought DATE NOT NULL,
  weight INTEGER NOT NULL,
  buy_price INTEGER NOT NULL,
  notes TEXT,
  is_forever BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cycles (
  id SERIAL PRIMARY KEY,
  sell_date DATE NOT NULL,
  sell_weight INTEGER NOT NULL,
  sell_price INTEGER NOT NULL,
  cash_generated INTEGER NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cycle_buybacks (
  id SERIAL PRIMARY KEY,
  cycle_id INTEGER REFERENCES cycles(id),
  buy_date DATE NOT NULL,
  buy_weight INTEGER NOT NULL,
  buy_price INTEGER NOT NULL,
  cash_spent INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_state (
  id SERIAL PRIMARY KEY,
  amount INTEGER NOT NULL DEFAULT 0,
  source_cycle_id INTEGER REFERENCES cycles(id),
  sale_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  gold_bar_buy INTEGER,
  gold_bar_sell INTEGER,
  gold_ornament_buy INTEGER,
  gold_ornament_sell INTEGER
);
`;

const SEED_SQL = `
INSERT INTO cash_state (amount)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM cash_state);

INSERT INTO lots (date_bought, weight, buy_price, notes, is_forever)
SELECT * FROM (VALUES
  ('2025-05-24'::DATE, 10, 51120, 'Ausiris', FALSE),
  ('2025-05-31'::DATE, 10, 51070, 'Ausiris', FALSE),
  ('2025-08-09'::DATE, 10, 50700, 'Ausiris', FALSE),
  ('2025-11-04'::DATE, 5,  61000, 'Ausiris', FALSE),
  ('2026-02-02'::DATE, 5,  68350, 'Ausiris', FALSE),
  ('2026-03-06'::DATE, 10, 77300, 'Ausiris', FALSE),
  ('2026-03-20'::DATE, 5,  76500, 'Ausiris', FALSE),
  ('2026-03-21'::DATE, 5,  74850, 'Ausiris', FALSE),
  ('2026-03-27'::DATE, 5,  68950, 'Ausiris', FALSE)
) AS v(date_bought, weight, buy_price, notes, is_forever)
WHERE NOT EXISTS (SELECT 1 FROM lots LIMIT 1);
`;

export async function POST() {
  try {
    await query(SCHEMA_SQL);
    await query(SEED_SQL);
    return NextResponse.json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    return NextResponse.json({ tables: tables.map(t => t.tablename) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
