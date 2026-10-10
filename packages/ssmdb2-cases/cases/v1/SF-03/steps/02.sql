-- SF-03, Lesung 2: 1 Wertungsschuss, die Probe ist weg
SET NAMES utf8mb4;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1168956429 AND `Stellung` = 0 AND `Treffer` = 1;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1168956429 AND `Stellung` = 0 AND `Treffer` = 2;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1168956429 AND `Stellung` = 0 AND `Treffer` = 3;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1168956429 AND `Stellung` = 0 AND `Treffer` = 4;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1168956429 AND `Stellung` = 0 AND `Treffer` = 5;
DELETE FROM `Serien` WHERE `ScheibenID` = 1168956429 AND `Stellung` = 0 AND `Serie` = 1;
UPDATE `Scheiben` SET `Trefferzahl` = 1, `TotalRing` = 90, `TotalRing01` = 98, `BesterTeiler01` = 9443, `BesterTeiler001` = 94433, `Zeitstempel` = '2026-10-03 19:03:47' WHERE `ScheibenID` = 1168956429;
INSERT INTO `Serien` (`ScheibenID`, `Stellung`, `Serie`, `Ring`, `Ring01`) VALUES (1168956429, 1, 1, 9, 98);
INSERT INTO `Treffer` (`ScheibenID`, `Stellung`, `Treffer`, `Serie`, `x`, `y`, `Innenzehner`, `Wertung`, `Text`, `Ring`, `Ring01`, `Teiler01`, `Teiler001`, `Zeitstempel`, `Millisekunden`) VALUES (1168956429, 1, 1, 1, 477, 815, 0, 2, '9', 90, 98, 9443, 94433, '2026-10-03 19:03:47', 558);
