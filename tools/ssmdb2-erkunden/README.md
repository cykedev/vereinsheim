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

3. Den Standard-Zugang zur SSMDB2 aus dem Meyton-Handbuch bereithalten. Er wird nur abgefragt, nie
   gespeichert.

## Im Schützenheim

1. Mac per Kabel ins Meyton-Gerätenetz, feste IP aus dem Workstation-Bereich (192.168.10.201 bis .239,
   Maske 255.255.255.0). **WLAN aus**, damit der Internet-Test das Gerätenetz prüft und nicht das WLAN.
2. Docker Desktop starten, dann:

   ```bash
   tools/ssmdb2-erkunden/erkunden.sh
   ```

   Andere Adresse: `--host 192.168.10.x`. Einzelne Phasen: `erkunden.sh checkliste dump` usw.; mit
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

Die Kopie lässt sich später in eine lokale Entwicklungs-Datenbank einspielen. Sie gehört nie ins Repo
(ADR-029).

## Was das Skript nie tut

In die Anlage schreiben (jede Sitzung ist read-only, gesendet werden nur `SELECT`, `SHOW`, `EXPLAIN`),
Tabellen sperren (die Kopie läuft ohne `LOCK TABLES`), das Passwort speichern oder Namen in `bericht/`
schreiben.

## Wenn etwas nicht klappt

- **Verbindung scheitert:** IP und Maske prüfen, `ping 192.168.10.200`; Port 3306 erreichbar?
  Benutzer und Passwort laut Handbuch.
- **Kein MySQL-Client:** Docker Desktop läuft nicht, oder das Image fehlt (`erkunden.sh selbsttest`).
- **Der Mitschnitt wird langsamer** (`# takt` im Protokoll): Die Abfragen dauern länger als 300 ms über
  der Grundlast; das Skript schont damit den Rechner, der live wertet. Das ist ein Befund, kein Fehler.
