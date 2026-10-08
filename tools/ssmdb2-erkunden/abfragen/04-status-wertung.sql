-- Thema: Status und Wertungsmodus
-- Frage: Welche Status-Werte kommen vor (Training gegen Wettkampf)?
-- Frage: Welche Wertungsmodi je Disziplin und Stellung (Modus 0 bei Probe? verdeckt 5/10?)
-- Belegt: SF-19, SF-20; Abschnitt „Status und Wertungsmodus“
SELECT Status, COUNT(*) AS scheiben FROM Scheiben GROUP BY Status ORDER BY scheiben DESC;
SELECT Starterliste, Rangliste, Status, COUNT(*) AS scheiben FROM Scheiben
GROUP BY Starterliste, Rangliste, Status ORDER BY scheiben DESC LIMIT 40;
SELECT Wertung, COUNT(*) AS treffer FROM Treffer GROUP BY Wertung;
SELECT s.DisziplinID, t.Stellung, t.Wertung, COUNT(*) AS treffer FROM Treffer t
JOIN Scheiben s ON s.ScheibenID = t.ScheibenID GROUP BY s.DisziplinID, t.Stellung, t.Wertung ORDER BY s.DisziplinID, t.Stellung, t.Wertung;
