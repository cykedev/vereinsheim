-- Nachgebaute SSMDB2 für den Selbsttest. Spalten nach vault/meyton/meyton-ssmdb2.md (Version 6.0.2),
-- Typen soweit bekannt nach dem Meyton-Handbuch V9 (SportpassID bigint seit V7, StandNrText, Serie,
-- Millisekunden), sonst geschätzt; das echte Schema liefert erst der Abend im Schützenheim.
-- MyISAM, weil das der ungünstigste Fall für Sperren ist (SF-51).

CREATE TABLE Version (
  Version varchar(20) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE Scheiben (
  ScheibenID int(11) NOT NULL,
  Starterliste varchar(50) DEFAULT NULL,
  StarterlisteID int(11) DEFAULT NULL,
  Startzeit datetime DEFAULT NULL,
  StartNr int(11) DEFAULT NULL,
  Nachname varchar(30) DEFAULT NULL,
  Vorname varchar(30) DEFAULT NULL,
  Geschlecht char(1) DEFAULT NULL,
  Land varchar(3) DEFAULT NULL,
  SportpassID bigint(20) DEFAULT NULL,
  StandNr int(11) DEFAULT NULL,
  StandNrText varchar(36) DEFAULT NULL,
  Disziplin varchar(50) DEFAULT NULL,
  DisziplinID int(11) DEFAULT NULL,
  Klasse varchar(50) DEFAULT NULL,
  KlasseID int(11) DEFAULT NULL,
  Verein varchar(50) DEFAULT NULL,
  VereinID int(11) DEFAULT NULL,
  Mannschaft varchar(50) DEFAULT NULL,
  MannschaftID int(11) DEFAULT NULL,
  Rangliste varchar(50) DEFAULT NULL,
  RanglisteID int(11) DEFAULT NULL,
  Gruppe varchar(50) DEFAULT NULL,
  GruppeID int(11) DEFAULT NULL,
  Status varchar(10) DEFAULT NULL,
  Trefferzahl int(11) DEFAULT NULL,
  TotalRing int(11) DEFAULT NULL,
  TotalRing01 int(11) DEFAULT NULL,
  BesterTeiler01 int(11) DEFAULT NULL,
  BesterTeiler001 int(11) DEFAULT NULL,
  Zeitstempel datetime DEFAULT NULL,
  PRIMARY KEY (ScheibenID)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE Serien (
  ScheibenID int(11) NOT NULL,
  Stellung int(11) NOT NULL,
  Serie int(11) NOT NULL,
  Ring int(11) DEFAULT NULL,
  Ring01 int(11) DEFAULT NULL,
  PRIMARY KEY (ScheibenID, Stellung, Serie)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE Treffer (
  ScheibenID int(11) NOT NULL,
  Stellung int(11) NOT NULL,
  Treffer int(11) NOT NULL,
  Serie smallint(6) DEFAULT NULL,
  x int(11) DEFAULT NULL,
  y int(11) DEFAULT NULL,
  Innenzehner tinyint(1) DEFAULT NULL,
  Wertung int(11) DEFAULT NULL,
  Text varchar(20) DEFAULT NULL,
  Ring int(11) DEFAULT NULL,
  Ring01 int(11) DEFAULT NULL,
  Teiler01 int(11) DEFAULT NULL,
  Teiler001 int(11) DEFAULT NULL,
  Zeitstempel datetime DEFAULT NULL,
  Millisekunden smallint(6) DEFAULT NULL,
  PRIMARY KEY (ScheibenID, Stellung, Treffer)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
