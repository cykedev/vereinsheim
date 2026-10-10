-- SF-19, Lesung 3: Königsscheibe: Wertungsschuss verdeckt, der Wert steht dahinter
SET NAMES utf8mb4;
DELETE FROM `Treffer` WHERE `ScheibenID` = -1915210867 AND `Stellung` = 0 AND `Treffer` = 1;
DELETE FROM `Treffer` WHERE `ScheibenID` = -1915210867 AND `Stellung` = 0 AND `Treffer` = 2;
DELETE FROM `Treffer` WHERE `ScheibenID` = -1915210867 AND `Stellung` = 0 AND `Treffer` = 3;
DELETE FROM `Serien` WHERE `ScheibenID` = -1915210867 AND `Stellung` = 0 AND `Serie` = 1;
UPDATE `Scheiben` SET `Trefferzahl` = 1, `TotalRing` = 100, `TotalRing01` = 106, `BesterTeiler01` = 3002, `BesterTeiler001` = 30017, `Zeitstempel` = '2026-10-17 19:22:15' WHERE `ScheibenID` = -1915210867;
INSERT INTO `Serien` (`ScheibenID`, `Stellung`, `Serie`, `Ring`, `Ring01`) VALUES (-1915210867, 1, 1, 10, 106);
INSERT INTO `Treffer` (`ScheibenID`, `Stellung`, `Treffer`, `Serie`, `x`, `y`, `Innenzehner`, `Wertung`, `Text`, `Ring`, `Ring01`, `Teiler01`, `Teiler001`, `Zeitstempel`, `Millisekunden`) VALUES (-1915210867, 1, 1, 1, -150, 260, 1, 5, '***', 100, 106, 3002, 30017, '2026-10-17 19:22:15', 837);
