-- Seed data: Current lots as of April 3, 2026
-- Only insert if table is empty

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
