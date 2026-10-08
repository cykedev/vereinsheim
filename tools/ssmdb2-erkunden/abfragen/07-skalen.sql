-- Thema: Skalen der Ring- und Teilerfelder
-- Frage: Ist Serien.Ring die Summe der ganzen Ringe, Serien.Ring01 die Summe der Zehntel (×10)?
-- Frage: Gilt dasselbe für Scheiben.TotalRing/TotalRing01, mit oder ohne Probe?
-- Frage: In welcher Einheit stehen Teiler01/Teiler001 (Verhältnis zum Abstand aus x, y)?
-- Frage: Ist Ring = FLOOR(Ring01 / 10)? Welche Spanne haben Millisekunden? Ab welchem Abstand Innenzehner?
-- Belegt: Stolperfalle „Ring-Felder unterschiedlich skaliert“, offene Frage „Teiler oder gerundete Lage“
SELECT COUNT(*) AS serien, SUM(s.Ring = t.ring) AS ring_gleich_summe, SUM(s.Ring01 = t.ring01) AS ring01_gleich_summe,
       SUM(s.Ring01 * 10 = t.ring01) AS ring01_mal_10, SUM(s.Ring01 = t.ring01 * 10) AS summe_mal_10
FROM Serien s JOIN (SELECT ScheibenID, Stellung, Serie, SUM(Ring) AS ring, SUM(Ring01) AS ring01 FROM Treffer GROUP BY ScheibenID, Stellung, Serie) t
  ON t.ScheibenID = s.ScheibenID AND t.Stellung = s.Stellung AND t.Serie = s.Serie;
SELECT COUNT(*) AS scheiben, SUM(s.TotalRing = t.ring_w) AS totalring_gleich_wertung, SUM(s.TotalRing = t.ring_alle) AS totalring_gleich_alle,
       SUM(s.TotalRing01 = t.ring01_w) AS totalring01_gleich_wertung, SUM(s.TotalRing01 = t.ring01_alle) AS totalring01_gleich_alle
FROM Scheiben s JOIN (SELECT ScheibenID, SUM(IF(Stellung > 0, Ring, 0)) AS ring_w, SUM(Ring) AS ring_alle,
  SUM(IF(Stellung > 0, Ring01, 0)) AS ring01_w, SUM(Ring01) AS ring01_alle FROM Treffer GROUP BY ScheibenID) t ON t.ScheibenID = s.ScheibenID;
SELECT MIN(Ring) AS ring_min, MAX(Ring) AS ring_max, MIN(Ring01) AS ring01_min, MAX(Ring01) AS ring01_max,
       SUM(Ring = FLOOR(Ring01 / 10)) AS ring_gleich_floor, COUNT(*) AS treffer FROM Treffer;
SELECT ROUND(MIN(Teiler01 / SQRT(x * x + y * y)), 4) AS teiler01_je_abstand_min, ROUND(MAX(Teiler01 / SQRT(x * x + y * y)), 4) AS teiler01_je_abstand_max,
       ROUND(MIN(Teiler001 / SQRT(x * x + y * y)), 4) AS teiler001_je_abstand_min, ROUND(MAX(Teiler001 / SQRT(x * x + y * y)), 4) AS teiler001_je_abstand_max
FROM Treffer WHERE x <> 0 OR y <> 0;
SELECT SUM(s.BesterTeiler01 = t.minimum) AS bester_teiler_gleich_min, COUNT(*) AS scheiben FROM Scheiben s
JOIN (SELECT ScheibenID, MIN(Teiler01) AS minimum FROM Treffer WHERE Stellung > 0 GROUP BY ScheibenID) t ON t.ScheibenID = s.ScheibenID;
SELECT MIN(Millisekunden) AS ms_min, MAX(Millisekunden) AS ms_max FROM Treffer;
SELECT FLOOR(s.DisziplinID / 10000000) AS entfernung, t.Innenzehner, ROUND(MIN(SQRT(t.x * t.x + t.y * t.y))) AS abstand_min,
       ROUND(MAX(SQRT(t.x * t.x + t.y * t.y))) AS abstand_max, COUNT(*) AS treffer
FROM Treffer t JOIN Scheiben s ON s.ScheibenID = t.ScheibenID GROUP BY entfernung, t.Innenzehner;
-- jüngste Scheibe mit Wertung im Detail (ohne Namen)
SELECT Stellung, Treffer, Serie, x, y, ROUND(SQRT(x * x + y * y)) AS abstand, Ring, Ring01, Teiler01, Teiler001,
       Innenzehner, Wertung, Text, Zeitstempel, Millisekunden FROM Treffer
WHERE ScheibenID = (SELECT ScheibenID FROM Treffer WHERE Stellung > 0 ORDER BY Zeitstempel DESC LIMIT 1)
ORDER BY Stellung, Treffer;
