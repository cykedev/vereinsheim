-- Thema: Sonderfälle in der Historie
-- Frage: Wie oft nur Probe, Scheiben ohne Treffer, Fehlschüsse, Platzhalter (x = y = 0), Handeinträge (Text)?
-- Frage: Tragen Probeschüsse eine Serie? Passt Trefferzahl zu den gezählten Wertungsschüssen?
-- Belegt: SF-01, SF-02, SF-07, SF-14, SF-15, SF-21
SELECT COUNT(*) AS nur_probe FROM Scheiben s
WHERE EXISTS (SELECT 1 FROM Treffer t WHERE t.ScheibenID = s.ScheibenID)
AND NOT EXISTS (SELECT 1 FROM Treffer t WHERE t.ScheibenID = s.ScheibenID AND t.Stellung > 0);
SELECT COUNT(*) AS ohne_treffer FROM Scheiben s WHERE NOT EXISTS (SELECT 1 FROM Treffer t WHERE t.ScheibenID = s.ScheibenID);
SELECT Serie, COUNT(*) AS probeschuesse FROM Treffer WHERE Stellung = 0 GROUP BY Serie;
SELECT Stellung, COUNT(*) AS treffer FROM Treffer GROUP BY Stellung;
SELECT COUNT(*) AS ohne_lage FROM Treffer WHERE x = 0 AND y = 0;
SELECT Ring, COUNT(*) AS treffer FROM Treffer WHERE Ring <= 1 GROUP BY Ring;
SELECT Text, COUNT(*) AS treffer FROM Treffer WHERE Text IS NOT NULL AND Text <> '' GROUP BY Text ORDER BY treffer DESC LIMIT 30;
SELECT SUM(s.Trefferzahl = w.wertung) AS gleich, SUM(s.Trefferzahl <> w.wertung) AS verschieden,
       SUM(s.Trefferzahl = w.alle) AS gleich_mit_probe FROM Scheiben s
JOIN (SELECT ScheibenID, SUM(Stellung > 0) AS wertung, COUNT(*) AS alle FROM Treffer GROUP BY ScheibenID) w
  ON w.ScheibenID = s.ScheibenID;
