-- Thema: Disziplinen
-- Frage: Welche DisziplinIDs und Namen gibt es, wie oft? Achtstellig oder vereinseigen kurz?
-- Frage: Welche IDs tragen mehrere Namen, welche Namen mehrere IDs (Varianten, Familien)?
-- Frage: Passt die Schusszahl aus der ID (letzte drei Ziffern) zur Trefferzahl?
-- Belegt: SF-09, SF-64, offene Fragen „Disziplin-Varianten“ und „LG/LP Training Spiegel“
SELECT DisziplinID, Disziplin, LENGTH(DisziplinID) AS stellen, COUNT(*) AS scheiben, MIN(Zeitstempel) AS erste, MAX(Zeitstempel) AS letzte
FROM Scheiben GROUP BY DisziplinID, Disziplin ORDER BY scheiben DESC;
SELECT DisziplinID, COUNT(DISTINCT Disziplin) AS namen FROM Scheiben GROUP BY DisziplinID HAVING namen > 1;
SELECT Disziplin, COUNT(DISTINCT DisziplinID) AS ids FROM Scheiben GROUP BY Disziplin HAVING ids > 1;
SELECT DisziplinID, MOD(DisziplinID, 1000) AS schuss_laut_id, Trefferzahl, COUNT(*) AS scheiben
FROM Scheiben GROUP BY DisziplinID, Trefferzahl ORDER BY DisziplinID, Trefferzahl;
