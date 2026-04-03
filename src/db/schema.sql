-- Gold Trading System Schema

CREATE TABLE IF NOT EXISTS lots (
  id SERIAL PRIMARY KEY,
  date_bought DATE NOT NULL,
  weight INTEGER NOT NULL,        -- in baht (5 or 10)
  buy_price INTEGER NOT NULL,     -- price per baht in THB
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
  status TEXT DEFAULT 'open',    -- open | closed
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

-- Initialize cash_state if empty
INSERT INTO cash_state (amount)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM cash_state);
