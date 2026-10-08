-- Thema: Schützen und SportpassID (nur Anzahlen, keine Namen oder Nummern)
-- Frage: Wie viele Scheiben haben eine SportpassID, wie viele keinen Namen oder --frei--?
-- Frage: Landen Trainings ohne Starter in der Ablage, und unter welchem Namen?
-- Frage: Läuft die SportpassID über (int(11)) oder ist sie gekappt? Gibt es IDs mit mehreren Namen?
-- Belegt: SF-13, SF-35, SF-36, offene Frage „Landen Trainings ohne Starter in der SSMDB2?“
SELECT COUNT(*) AS gesamt, SUM(SportpassID > 0) AS mit_sportpass, SUM(TRIM(Nachname) = '') AS ohne_namen,
       SUM(TRIM(Nachname) = '--frei--') AS frei FROM Scheiben;
SELECT COUNT(*) AS frei_mit_treffern FROM Scheiben s WHERE TRIM(s.Nachname) = '--frei--'
AND EXISTS (SELECT 1 FROM Treffer t WHERE t.ScheibenID = s.ScheibenID);
SELECT LENGTH(MAX(SportpassID)) AS stellen_der_groessten, SUM(SportpassID = 2147483647) AS gekappt_auf_int_max,
       SUM(SportpassID < 0) AS negativ FROM Scheiben;
SELECT COUNT(*) AS ids_mit_mehreren_namen FROM (
  SELECT SportpassID FROM Scheiben WHERE SportpassID > 0 GROUP BY SportpassID HAVING COUNT(DISTINCT Nachname, Vorname) > 1
) x;
SELECT COUNT(*) AS namen_mit_mehreren_ids FROM (
  SELECT Nachname, Vorname FROM Scheiben WHERE SportpassID > 0 AND TRIM(Nachname) NOT IN ('', '--frei--')
  GROUP BY Nachname, Vorname HAVING COUNT(DISTINCT SportpassID) > 1
) x;
SELECT COUNT(DISTINCT SportpassID) AS verschiedene_sportpass_ids FROM Scheiben WHERE SportpassID > 0;
