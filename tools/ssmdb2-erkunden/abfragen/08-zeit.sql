-- Thema: Zeiten
-- Frage: Sind Zeitstempel und Startzeit DATETIME oder TIMESTAMP (dann hängen sie an der Sitzungs-Zeitzone)?
-- Frage: Ist Scheiben.Zeitstempel die Zeit des letzten Schusses, später oder früher?
-- Frage: Widersprechen sich Treffer-Nummer und Zeit innerhalb einer Stellung?
-- Belegt: SF-29, SF-30, SF-31, SF-32, SF-50
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND (DATA_TYPE IN ('datetime', 'timestamp', 'date', 'time') OR COLUMN_NAME LIKE '%zeit%');
SELECT SUM(s.Zeitstempel = t.letzter) AS gleich_letztem_schuss, SUM(s.Zeitstempel > t.letzter) AS spaeter,
       SUM(s.Zeitstempel < t.letzter) AS frueher, COUNT(*) AS scheiben
FROM Scheiben s JOIN (SELECT ScheibenID, MAX(Zeitstempel) AS letzter FROM Treffer GROUP BY ScheibenID) t ON t.ScheibenID = s.ScheibenID;
SELECT COUNT(*) AS nummer_gegen_zeit FROM Treffer a JOIN Treffer b
  ON b.ScheibenID = a.ScheibenID AND b.Stellung = a.Stellung AND b.Treffer = a.Treffer + 1
WHERE b.Zeitstempel < a.Zeitstempel OR (b.Zeitstempel = a.Zeitstempel AND b.Millisekunden < a.Millisekunden);
SELECT COUNT(*) AS probe_nach_wertung FROM Treffer p JOIN (
  SELECT ScheibenID, MIN(Zeitstempel) AS erste_wertung FROM Treffer WHERE Stellung > 0 GROUP BY ScheibenID
) w ON w.ScheibenID = p.ScheibenID WHERE p.Stellung = 0 AND p.Zeitstempel > w.erste_wertung;
