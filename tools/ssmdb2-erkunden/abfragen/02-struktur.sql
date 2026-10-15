-- Thema: Struktur, Engine, Spaltentypen, Indizes
-- Frage: Welche Engine (MyISAM sperrt beim Lesen, InnoDB nicht)?
-- Frage: Welche Spalten und Typen genau (Grundlage für Adapter und Testanlage)?
-- Frage: Welche Indizes gibt es (Kosten der Änderungserkennung)?
-- Belegt: SF-25, SF-31, SF-49, SF-51
SHOW TABLE STATUS;
SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_SET_NAME
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION;
SHOW CREATE TABLE Scheiben;
SHOW CREATE TABLE Serien;
SHOW CREATE TABLE Treffer;
SHOW INDEX FROM Scheiben;
SHOW INDEX FROM Serien;
SHOW INDEX FROM Treffer;
SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();
