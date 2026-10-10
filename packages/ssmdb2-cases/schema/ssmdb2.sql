-- Schema der Meyton-Ablage SSMDB2, wie `SHOW CREATE TABLE` es an der Vereinsanlage am 9. Oktober 2026 zeigte
-- (ShootMaster 6.0.2, MariaDB 10.6, Datenbankversion 9). Nur die Struktur, keine Daten (ADR-029).
-- Reihenfolge so, dass die Fremdschlüssel beim Anlegen ihr Ziel finden.

CREATE TABLE `Version` (
  `Versionsnummer` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

CREATE TABLE `Scheiben` (
  `ScheibenID` int(11) NOT NULL,
  `Starterliste` varchar(36) NOT NULL,
  `StarterlistenID` int(11) NOT NULL,
  `Startzeit` datetime NOT NULL,
  `StartNr` int(11) NOT NULL,
  `Nachname` varchar(36) NOT NULL,
  `Vorname` varchar(36) NOT NULL,
  `Geschlecht` enum('male','female','unknown') NOT NULL DEFAULT 'unknown',
  `Land` varchar(3) NOT NULL,
  `SportpassID` bigint(20) NOT NULL,
  `StandNr` smallint(6) NOT NULL,
  `StandNrText` varchar(36) NOT NULL,
  `Disziplin` varchar(36) NOT NULL,
  `DisziplinID` int(11) NOT NULL,
  `Klasse` varchar(36) NOT NULL,
  `KlassenID` int(11) NOT NULL,
  `Verein` varchar(36) NOT NULL,
  `VereinsID` int(11) NOT NULL,
  `Mannschaft` varchar(36) NOT NULL,
  `MannschaftsID` int(11) NOT NULL,
  `Rangliste` varchar(36) NOT NULL,
  `RanglistenID` int(11) NOT NULL,
  `Gruppe` varchar(36) NOT NULL,
  `GruppenID` int(11) NOT NULL,
  `Status` varchar(72) NOT NULL,
  `Trefferzahl` smallint(6) NOT NULL,
  `TotalRing` int(11) NOT NULL,
  `TotalRing01` int(11) NOT NULL,
  `BesterTeiler01` int(11) NOT NULL,
  `BesterTeiler001` int(11) NOT NULL,
  `Zeitstempel` datetime NOT NULL,
  PRIMARY KEY (`ScheibenID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

CREATE TABLE `Serien` (
  `ScheibenID` int(11) NOT NULL,
  `Stellung` smallint(6) NOT NULL,
  `Serie` smallint(6) NOT NULL,
  `Ring` int(11) NOT NULL,
  `Ring01` int(11) NOT NULL,
  PRIMARY KEY (`ScheibenID`,`Stellung`,`Serie`),
  CONSTRAINT `Serien_ibfk_1` FOREIGN KEY (`ScheibenID`) REFERENCES `Scheiben` (`ScheibenID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

CREATE TABLE `Treffer` (
  `ScheibenID` int(11) NOT NULL,
  `Stellung` smallint(6) NOT NULL,
  `Treffer` smallint(6) NOT NULL,
  `Serie` smallint(6) NOT NULL,
  `x` int(11) NOT NULL,
  `y` int(11) NOT NULL,
  `Innenzehner` tinyint(1) NOT NULL,
  `Wertung` int(11) NOT NULL,
  `Text` varchar(36) NOT NULL,
  `Ring` int(11) NOT NULL,
  `Ring01` int(11) NOT NULL,
  `Teiler01` int(11) NOT NULL,
  `Teiler001` int(11) NOT NULL,
  `Zeitstempel` datetime NOT NULL,
  `Millisekunden` smallint(6) NOT NULL,
  PRIMARY KEY (`ScheibenID`,`Stellung`,`Treffer`),
  CONSTRAINT `Treffer_ibfk_1` FOREIGN KEY (`ScheibenID`) REFERENCES `Scheiben` (`ScheibenID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
