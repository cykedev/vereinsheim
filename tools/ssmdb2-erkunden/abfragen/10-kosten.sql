-- Thema: Kosten der Abfragen der Brücke
-- Frage: Lesen die Abfragen der Änderungserkennung die ganze Tabelle (type = ALL)?
-- Belegt: SF-49, SF-50, SF-52; Abschnitt „Arbeitsweise“ der Brücke
EXPLAIN SELECT ScheibenID, Zeitstempel, Trefferzahl FROM Scheiben WHERE Zeitstempel >= NOW() - INTERVAL 2 MINUTE;
EXPLAIN SELECT MAX(Zeitstempel) FROM Treffer;
EXPLAIN SELECT DISTINCT ScheibenID FROM Treffer WHERE Zeitstempel >= NOW() - INTERVAL 2 MINUTE;
EXPLAIN SELECT * FROM Treffer WHERE ScheibenID = (SELECT MAX(ScheibenID) FROM Scheiben);
EXPLAIN SELECT * FROM Serien WHERE ScheibenID = (SELECT MAX(ScheibenID) FROM Scheiben);
