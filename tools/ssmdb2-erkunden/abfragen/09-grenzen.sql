-- Thema: Grenzen des Vertrags (packages/ingest-contract/src/limits.ts)
-- Frage: Wie viele Spalten je Tabelle (Grenze 200), wie viele Treffer und Serien je Scheibe (2000, 200)?
-- Frage: Wie lang werden Textwerte höchstens (Grenze 4096 UTF-16-Einheiten)?
-- Belegt: Vertrag v1
SELECT TABLE_NAME, COUNT(*) AS spalten, MAX(CHAR_LENGTH(COLUMN_NAME)) AS laengster_name, MAX(CHAR_LENGTH(COLUMN_TYPE)) AS laengster_typ,
       MAX(CHARACTER_MAXIMUM_LENGTH) AS groesste_textspalte
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_NAME;
SELECT MAX(n) AS max_treffer_je_scheibe, ROUND(AVG(n)) AS schnitt FROM (SELECT COUNT(*) AS n FROM Treffer GROUP BY ScheibenID) x;
SELECT MAX(n) AS max_probe_je_scheibe FROM (SELECT COUNT(*) AS n FROM Treffer WHERE Stellung = 0 GROUP BY ScheibenID) x;
SELECT MAX(n) AS max_serien_je_scheibe FROM (SELECT COUNT(*) AS n FROM Serien GROUP BY ScheibenID) x;
SELECT MAX(CHAR_LENGTH(Starterliste)) AS starterliste, MAX(CHAR_LENGTH(Nachname)) AS nachname, MAX(CHAR_LENGTH(Vorname)) AS vorname,
       MAX(CHAR_LENGTH(Disziplin)) AS disziplin, MAX(CHAR_LENGTH(Verein)) AS verein, MAX(CHAR_LENGTH(Mannschaft)) AS mannschaft,
       MAX(CHAR_LENGTH(Rangliste)) AS rangliste, MAX(CHAR_LENGTH(Gruppe)) AS gruppe, MAX(CHAR_LENGTH(Klasse)) AS klasse FROM Scheiben;
SELECT MAX(CHAR_LENGTH(Text)) AS text FROM Treffer;
