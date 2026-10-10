-- SF-21, Lesung 2: Schuss 8 korrigiert
UPDATE `Scheiben` SET `TotalRing01` = 2045 WHERE `ScheibenID` = -1743610867;
UPDATE `Serien` SET `Ring01` = 1035 WHERE `ScheibenID` = -1743610867 AND `Stellung` = 1 AND `Serie` = 1;
UPDATE `Treffer` SET `x` = 40, `y` = -30, `Text` = '10.8', `Ring01` = 108, `Teiler01` = 500, `Teiler001` = 5000 WHERE `ScheibenID` = -1743610867 AND `Stellung` = 1 AND `Treffer` = 8;
