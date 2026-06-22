-- Ringteiler-Neuberechnung für Serien mit DECIMAL-Disziplinen
-- Bestehende Werte wurden fälschlicherweise mit maxRings=100 berechnet.
-- Korrekte Formel für DECIMAL: ROUND((109 - rings + teiler * teilerFaktor) * 10) / 10
-- Entspricht: Math.round((109 - rings + teiler * faktor) * 10) / 10
UPDATE "Series" s
SET "ringteiler" = ROUND(
  (109.0 - s."rings" + s."teiler" * d."teilerFaktor") * 10
) / 10
FROM "Discipline" d
WHERE s."disciplineId" = d."id"
  AND d."scoringType" = 'DECIMAL';
