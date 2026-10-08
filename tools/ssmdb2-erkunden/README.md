# SSMDB2 vor Ort erkunden

Ein Skript für einen Abend im Schützenheim (SP-0.1 und SP-0.6 der Spiegel-Roadmap). Es liest die
Meyton-Ablage **nur**, sichert sie vollständig auf dem Mac, beantwortet die SQL-Checkliste und führt
durch ein Schießprotokoll, das man allein schießen kann, während es jede Sekunde mitliest.

## Zu Hause vorbereiten

1. Docker Desktop installiert und das Image da: `docker pull mariadb:11` (am Abend braucht es kein
   Internet). Alternativ ein lokaler Client: `brew install mariadb`.
2. Einmal den Selbsttest laufen lassen. Er baut eine Anlage im Container nach und spielt den ganzen
   Abend durch (etwa eine Minute):

   ```bash
   tools/ssmdb2-erkunden/test/selbsttest.sh
   ```

3. Den Standard-Zugang bereithalten: Benutzer `meyton` (das Skript schlägt ihn vor), das Passwort
   steht im Meyton-Handbuch zur SSMDB2 auf Seite 3 („Scheibenablage SSMDB2“, Datenbankversion 9). Es
   wird nur abgefragt und nie gespeichert, auch nicht im Repo.
4. Mac ans Netzteil: Das Skript hält ihn wach (`caffeinate`), auf Akku kann er trotzdem schlafen.

## Im Schützenheim

1. Mac per Kabel ins Meyton-Gerätenetz mit fester IP **außerhalb** der Meyton-Bereiche, etwa
   `192.168.20.50`, Maske **255.255.0.0** (das Meyton-Netz ist ein /16), kein Gateway. Nicht
   .200–.239 nehmen: Das sind Server und Meyton-Clients, an der IP erkennt Meyton die Rolle einer
   Workstation. Vorher in der Geräteübersicht prüfen, dass die Adresse frei ist. **WLAN aus**, damit der
   Internet-Test das Gerätenetz prüft und nicht das WLAN.
2. Docker Desktop starten, dann:

   ```bash
   tools/ssmdb2-erkunden/erkunden.sh
   ```

   Der Meyton-Server hat laut Handbuch `192.168.10.200`, Port 3306, Datenbank `SSMDB2`; andere
   Adresse: `--host 192.168.10.x`. Einzelne Phasen: `erkunden.sh checkliste dump` usw.; mit
   `--ausgabe <Ordner>` landen weitere Läufe im selben Ordner.
3. Die Phasen nacheinander, jede fragt vorher nach:
   - **verbinden**: Version, Uhr und Zeitzonen der Anlage, Zeichensatz, Internet, Freigaben.
   - **checkliste** und **dump**: lesen ganze Tabellen. **Nur, wenn gerade niemand schießt.**
   - **protokoll**: elf Schritte. Jeder Schritt zeigt, was zu schießen ist; danach Enter, `s`
     überspringt, `q` beendet. Nach Ausdrucken die ID aus dem Fuß eintippen (`ID: ff914420`).
     Optionale Schritte (Korrektur, verdeckte Wertung …) einfach überspringen, wenn die Anlage sie
     nicht hergibt.
   - **abschluss**: Checkliste ein zweites Mal, Prüfung auf Namen im Bericht.
4. Ausdrucke aufheben. Wer mag, öffnet den QR-Link des Ausdrucks auf dem Mac und speichert das PDF
   unter `privat/pdf/` (enthält Namen).

## Was herauskommt

Alles unter `~/ssmdb2-erkundung/<Datum_Zeit>/`:

| Ordner | Inhalt | Weitergeben? |
|---|---|---|
| `bericht/` | Antworten, Schema, Schritte, Mitschnitt mit Pseudonymen (`P1`, `S1` …), `LIESMICH.md` | ja |
| `privat/` | vollständige Kopie `ssmdb2.sql.gz`, Rohprotokoll mit Namen | **nein**, bleibt auf dem Mac |

Die Kopie lässt sich später in eine lokale Entwicklungs-Datenbank einspielen, mit einem
MariaDB-Client (der Dump beginnt mit einer Zeile, die ein Oracle-`mysql` nicht kennt). Sie gehört nie
ins Repo (ADR-029).

## Was das Skript nie tut

In die Anlage schreiben: Abfragen laufen in Read-only-Sitzungen und senden nur `SELECT`, `SHOW`,
`EXPLAIN`; die Kopie (`mariadb-dump`) sendet dazu nur Sitzungsbefehle (`SET`, `START TRANSACTION`,
`SAVEPOINT`), kein `LOCK TABLES`. Lange Abfragen der Checkliste brechen nach 60 s ab. Außerdem nie:
das Passwort speichern oder Namen in `bericht/` schreiben (eine Namensprüfung am Ende meldet Treffer).

## Wenn etwas nicht klappt

- **Verbindung scheitert:** IP und Maske (255.255.0.0) prüfen, `ping 192.168.10.200`; Port 3306
  erreichbar (`nc -z 192.168.10.200 3306`)? Benutzer und Passwort laut Handbuch.
- **Docker Desktop läuft nicht** oder das Image fehlt: `erkunden.sh selbsttest` sagt, was fehlt.
- **„Mitschnitt sieht keine Scheibe“** nach Schritt 1: Ist der SSMDB2-Dienst im Kontrollzentrum auf
  Echtzeit gestellt? Stimmt die Uhr (`umgebung.md`)? Der Mitschnitt liest ab dem jüngsten Eintrag der
  Ablage, ein Zeitzonenversatz allein stört ihn nicht.
- **Ein Lauf bricht ab:** Das Skript nennt den Ordner und wie es weitergeht, etwa
  `erkunden.sh --ausgabe ~/ssmdb2-erkundung/<Ordner> protokoll abschluss`.
- **Der Mitschnitt wird langsamer** (`# takt` im Protokoll): Die Abfragen dauern länger als 300 ms über
  der Grundlast; das Skript schont damit den Rechner, der live wertet. Das ist ein Befund, kein Fehler.
