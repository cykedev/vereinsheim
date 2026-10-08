-- Thema: Überblick über die Ablage
-- Frage: Wie viele Scheiben und Treffer, wie weit reicht die Historie?
-- Frage: Wie groß und wie verteilt sind die ScheibenIDs (vorzeichenbehaftet, negativ)?
-- Frage: Wie oft fehlt die Startzeit?
-- Belegt: SF-23, SF-32, Stolperfallen „Startzeit oft 0000-00-00“ und „ScheibenID vorzeichenbehaftet“
SELECT COUNT(*) AS scheiben, MIN(Zeitstempel) AS erste, MAX(Zeitstempel) AS letzte FROM Scheiben;
SELECT COUNT(*) AS treffer, SUM(Stellung = 0) AS davon_probe, MIN(Zeitstempel) AS erster, MAX(Zeitstempel) AS letzter FROM Treffer;
SELECT COUNT(*) AS serien FROM Serien;
SELECT MIN(ScheibenID) AS kleinste_id, MAX(ScheibenID) AS groesste_id, SUM(ScheibenID < 0) AS negative_ids FROM Scheiben;
SELECT SUM(Startzeit IS NULL OR Startzeit < '1971-01-01') AS ohne_startzeit, COUNT(*) AS gesamt FROM Scheiben;
SELECT DATE_FORMAT(Zeitstempel, '%Y-%m') AS monat, COUNT(*) AS scheiben FROM Scheiben GROUP BY monat ORDER BY monat;
