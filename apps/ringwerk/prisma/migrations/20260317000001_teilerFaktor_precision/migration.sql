-- Increase teilerFaktor precision from Decimal(4,3) to Decimal(9,7)
-- Allows storing 7 decimal places (e.g. 0.3333333 for Luftpistole 1/3 factor).
-- Non-breaking: existing values (1.000, 0.333 etc.) are preserved and widened.

ALTER TABLE "Discipline" ALTER COLUMN "teilerFaktor" TYPE DECIMAL(9,7);
