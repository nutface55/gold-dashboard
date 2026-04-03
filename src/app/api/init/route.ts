import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    const schemaPath = path.join(process.cwd(), 'src/db/schema.sql');
    const seedPath = path.join(process.cwd(), 'src/db/seed.sql');

    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const seed = fs.readFileSync(seedPath, 'utf-8');

    // Run schema
    await query(schema);
    // Run seed
    await query(seed);

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
