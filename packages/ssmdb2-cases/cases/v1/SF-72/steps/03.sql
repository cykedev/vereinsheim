-- SF-72, Lesung 3: 5 neue Probeschüsse, die alten sind weg
DELETE FROM `Treffer` WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 6;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 7;
DELETE FROM `Treffer` WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 8;
UPDATE `Scheiben` SET `Zeitstempel` = '2026-10-06 19:10:30' WHERE `ScheibenID` = 1428156429;
UPDATE `Serien` SET `Ring` = 46, `Ring01` = 494 WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Serie` = 1;
UPDATE `Treffer` SET `x` = -190, `y` = -27, `Innenzehner` = 1, `Text` = '10*', `Ring` = 100, `Ring01` = 107, `Teiler01` = 1919, `Teiler001` = 19191, `Zeitstempel` = '2026-10-06 19:07:30' WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 1;
UPDATE `Treffer` SET `x` = -135, `y` = 957, `Innenzehner` = 0, `Text` = '9', `Ring` = 90, `Ring01` = 97, `Teiler01` = 9665, `Teiler001` = 96648, `Zeitstempel` = '2026-10-06 19:08:15' WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 2;
UPDATE `Treffer` SET `x` = 965, `y` = -2213, `Text` = '7', `Ring` = 70, `Ring01` = 79, `Teiler01` = 24142, `Teiler001` = 241425, `Zeitstempel` = '2026-10-06 19:09:00' WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 3;
UPDATE `Treffer` SET `x` = 28, `y` = -463, `Innenzehner` = 1, `Text` = '10*', `Ring` = 100, `Ring01` = 104, `Teiler01` = 4638, `Teiler001` = 46385, `Zeitstempel` = '2026-10-06 19:09:45' WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 4;
UPDATE `Treffer` SET `x` = 111, `y` = -186, `Innenzehner` = 1, `Text` = '10*', `Ring` = 100, `Ring01` = 107, `Teiler01` = 2166, `Teiler001` = 21660, `Zeitstempel` = '2026-10-06 19:10:30' WHERE `ScheibenID` = 1428156429 AND `Stellung` = 0 AND `Treffer` = 5;
