---
id: ringwerk-pruefbestand
type: operation
title: "Ringwerk — Prüfbestand und Abgleich vor jedem Release"
aliases: ["Prüfbestand Ringwerk", "Abgleich Ringwerk"]
keywords: [Prüfbestand, Abgleich, Ausgangsstand, Referenz, Baseline, Vergleich vorher nachher, Abläufe, pruefdaten, pruefen:aufnehmen, pruefen:vergleichen, pruefen:ablaeufe, Gegenprobe, ringwerk_pruef, echte Daten, Release-Prüfung, Charakterisierung, Bracket, PDF-Text]
part_of: ["[[ringwerk]]"]
governed_by: ["[[adr-032]]", "[[adr-029]]"]
relates_to: ["[[operations]]", "[[competition-types]]", "[[playoffs-knockout-system]]", "[[pdf-public-urls]]"]
---

**TL;DR** Erfundene Wettbewerbe jeder Art in jeder Phase (`pnpm --filter ringwerk pruefdaten`, 92 Wettbewerbe in `ringwerk_pruef`). Davon ist ein Ausgangsstand der Seiten, Brackets und PDFs committet (`tools/pruefdaten/referenz/`). Vor jedem Merge und Release, der Ringwerk berührt, laufen `pruefen:vergleichen` (ohne Fehler), `pruefen:ablaeufe` (grün) und derselbe Vergleich an der Kopie der echten Daten (`--echt`, nur lesend).

# Ringwerk — Prüfbestand und Abgleich

Ringwerk trägt den laufenden Wettkampfbetrieb. Eine Änderung an der Oberfläche darf weder Zahlen, Reihenfolge, Plätze,
Paarungen, Sieger noch den Text eines PDFs ändern ([[adr-032]], Plan „Design 2 für alle Apps“, Teil R). Der Abgleich
belegt das, bevor etwas nach `main` oder auf den VPS geht.

## Zweck

- **Prüfbestand:** jede Zeile der Phasen-Matrix als eigener, erfundener Wettbewerb. Liga Hin/Rück und Best-of 3/5 von L0
  (ohne Teilnehmer) bis L7 (abgeschlossen, archiviert), Playoffs mit 16, 8 und 4, Finale mit Hauptwertung,
  Stichkriterium und Verlängerung. Dazu Events je Wertung und Zielwert, Teams, Gäste, Saisons je Sortierung, Ränder.
  Namen sind erfunden ([[adr-029]]). Geschrieben wird über Ringwerks eigene Server-Actions, ein Lauf ergibt immer
  dieselben Daten (Prüfsumme). Einzige Ausnahme ist der Kampflos-Sieg: Dafür hat Ringwerk weder Action noch Oberfläche.
- **Ausgangsstand:** je Wettbewerb, welche Seite und welches PDF für ADMIN und USER erreichbar ist (oder wohin es
  umleitet). Die Sportleitung (MANAGER) sieht dieselben Seiten wie ADMIN bis auf das Protokoll; sie bedient dafür die
  Abläufe am Telefon. Aufgenommen werden der Text unter `main` bei 390 und 1280 px, der Aufbau jedes Brackets (Runden, Paarungen, Stand) und der
  Text jedes PDFs. Die Bilder (Seiten, Brackets, PDF-Seiten) liegen nur lokal unter `reports/ringwerk-referenz/`.
- **Abläufe:** je Wettbewerbsart von Anlegen bis Archivieren oder Löschen über die Oberfläche. Einmal am Telefon als
  Sportleitung, einmal am Desktop als Admin. Nach jedem Schritt prüft das Werkzeug die Zeilen in der Datenbank.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm --filter ringwerk pruefdaten` | frische Prüfdatenbank `ringwerk_pruef`, Matrix-Prüfung, Prüfsumme (`--pruefsumme`, `--zeilen`, `--erwartet`) |
| `pnpm --filter ringwerk build` | der Stand, den das Werkzeug startet (eigener Server auf :3010) |
| `pnpm --filter ringwerk pruefen:vergleichen` | neu aufnehmen und mit dem Ausgangsstand vergleichen; Bericht und Bilder vorher/nachher unter `reports/ringwerk-vergleich/<zeit>/` |
| `pnpm --filter ringwerk pruefen:ablaeufe` | Abläufe am Telefon und am Desktop; baut die Prüfdatenbank vorher selbst neu |
| `… --echt` | Aufnahme und Vergleich an der Dev-Datenbank mit der Kopie der echten Daten; alles nur unter `reports/ringwerk-echt/` |
| `pnpm --filter ringwerk pruefen:aufnehmen` | Ausgangsstand neu schreiben, nur nach Freigabe durch den User; immer vollständig (verweigert `--nur`) |
| `… --gegenprobe` | mit `--vergleichen`: zwei Tabellenzeilen vertauschen, der Vergleich muss rot sein |
| `… --nur <wort>` | nur Wettbewerbe (bzw. Abläufe), deren Schlüssel das Wort enthält |

Laufzeit: Aufnahme oder Vergleich des Prüfbestands etwa 4,5 Minuten, Abläufe etwa 6 Minuten. Nicht im Gate: braucht
Chrome, Poppler, den Dev-Postgres und einen Build. Der eigene Server bindet nur an `127.0.0.1`.

## Was streng ist, was ein Hinweis

- **Fehler:** andere Erreichbarkeit; eine andere **Datenfolge** einer Seite (alle Zahlen, Namen und Wörter, die ein
  Ergebnis tragen, in Lesereihenfolge, ohne Beschriftungen; Namen in beiden Schreibweisen gleich). Wörter mit Ergebnis
  sind etwa Freilos, Kampflos, Zurückgezogen, Verlängerung, Ausstehend, Gast und die Rundennamen (`DATA_WORDS` in
  `normalize.ts`); ein anderes Bracket; anderer PDF-Text; ein fehlender oder
  neuer Wettbewerb.
- **Hinweis:** gleiche Daten, andere Beschriftung. Mit Design 2 erwartet, der User sieht sie in der Übersicht durch.
- **Bilder:** Seitenbilder dürfen sich mit Design 2 ändern. Streng ist beim PDF der Text; seine Bilder unterscheiden
  sich mindestens im Erstelldatum und sieht ein Mensch durch. Die HTML-Datei stellt jedes geänderte Bild vorher und
  nachher nebeneinander, die PDF-Seiten in einem eigenen Abschnitt.
- **Herausgenommen**, weil es je Lauf wechselt: das Erstelldatum im PDF-Kopf, die Adresse des eigenen Servers in der
  gedruckten URL (jede andere Adresse bleibt stehen) und die Startnummern der Starterliste. Ringwerk lost sie bei jedem Abruf neu aus; geprüft wird, dass es genau
  1 bis n sind. Der QR-Code (mit Zugangs-Token) steht nicht im Text.
- **Bestand:** Vor dem Vergleich muss der Prüfbestand dem des Ausgangsstands entsprechen (Prüfsumme über alle Tabellen
  ohne `updatedAt` der Disziplinen, das Ringwerk bei jedem Start setzt). Nach `pruefen:ablaeufe` deshalb erst
  `pruefdaten`.

## Gleichstand und Neuaufbau

Ringwerk ordnet Zeilen mit gleichem Sortierschlüssel nicht eindeutig: gleiche Nachnamen in Listen, die Plätze im
Bracket (alle Paarungen einer Runde haben dieselbe Zeit), die Seite im Finale ([[ringwerk]], offene Einzelpunkte). Die
Folge hängt an den IDs, und die sind in jedem Aufbau des Prüfbestands andere. Deshalb:

- **Eindeutig** ist der Vergleich auf **demselben Aufbau** wie die Aufnahme: 0 Fehler, belegt am 18. Oktober 2026.
- Nach einem Neuaufbau meldet er bei unveränderter Ringwerk-Version rund 90 bis 120 Fehler, alle Vertauschungen bei
  Gleichstand (geprüft: gleiche Zeichen, andere Reihenfolge) und die daraus folgende Vorschau im Bracket. Der Vergleich
  sagt das in einem Hinweis, wenn der Aufbau ein anderer ist (`build` in `_stand.json`).
- Der Aufbau ist seit diesem Stand physisch reproduzierbar (eine Verbindung, `fillfactor = 50`); die Folge bei
  Gleichstand bleibt trotzdem an den IDs. Ganz eindeutig wird der Vergleich erst, wenn Ringwerk überall einen zweiten
  Sortierschlüssel hat; danach den Ausgangsstand neu aufnehmen.
- Bis dahin für einen Ringwerk-Merge: `pruefdaten`, dann `pruefen:aufnehmen` auf dem alten Stand und
  `pruefen:vergleichen` auf dem neuen, ohne Neuaufbau dazwischen. Der committete Ausgangsstand ist der vom User
  bestätigte Stand zum Durchsehen.

## Vor jedem Merge und Release, der Ringwerk berührt

1. `pnpm check` grün, `pnpm --filter ringwerk build`.
2. `pnpm --filter ringwerk pruefdaten`, dann `pruefen:vergleichen`: **0 Fehler**. Hinweise und geänderte Seitenbilder
   sieht der User in `vorher-nachher.html` durch, die PDF-Seiten auf mehr als das Erstelldatum.
3. `pnpm --filter ringwerk pruefen:ablaeufe`: alle Schritte grün oder als bekannter Befund markiert.
4. `pruefen:aufnehmen --echt` auf dem Stand vor der Änderung, danach `pruefen:vergleichen --echt` auf dem neuen Stand:
   0 Fehler. Die Dev-Datenbank holt der User vorher mit `vereinsheim dev-restore ringwerk`. Das Werkzeug stellt die
   Sitzung des ältesten aktiven Admin- und Mitgliedskontos selbst aus (eigenes `NEXTAUTH_SECRET`), ohne Passwort. Es
   liest nur und belegt mit einem Fingerabdruck je Tabelle, dass nichts geschrieben wurde. Einzige Schreibung ist die
   von Ringwerk selbst: Beim Start gleicht die App die Standarddisziplinen ab (`updatedAt`, fehlende legt sie an), wie
   in Produktion. Der Vergleich verweigert sich, wenn die Datenbank nicht mehr die der Aufnahme ist.
5. Ändert sich der Ausgangsstand gewollt (etwa „noch kein Ergebnis“ statt „–“), nimmt ihn `pruefen:aufnehmen` nach
   Freigabe durch den User neu auf, in einem eigenen Commit.
6. Release nach [[operations#Release von Ringwerk]].

## Stand 18. Oktober 2026

- Ausgangsstand vom User bestätigt, aufgenommen auf `28f34bd1` (Ringwerk wie `main`). Vergleich auf demselben
  Aufbau: 0 Fehler, 0 Hinweise. Gegenprobe rot. Nach Neuaufbau nur Vertauschungen bei Gleichstand (siehe oben).
- Abläufe: alle Schritte grün bis auf einen bekannten Befund. Nach einem Feldfehler beim Anlegen springt die
  Disziplin auf „Gemischt (Faktor-Korrektur)“ zurück. Wer nur den Namen nachträgt, legt still einen gemischten
  Wettbewerb an. Die Radix-Auswahl mit `name` folgt dem Zurücksetzen des Formulars durch React. Behoben wird das außerhalb
  von Teil R; bis dahin führt `KNOWN` in `tools/pruefen-ringwerk/ablaeufe.ts` den Befund.
- Echte Daten (11 Wettbewerbe, nur ein Admin-Konto aktiv, kein Mitglied): Vergleich 0 Fehler. Sie enthalten Liga
  Best-of-3 in L1, L2 und L7 ohne Playoffs, Freilos, Events (Ringe, Zielwert), Saisons (Teiler/Ringe abwechselnd) und
  öffentliche PDFs mit und ohne Passwort. Keine Hin/Rück-Liga, keine Playoffs, keine Teams, kein Rückzug, kein
  Kampflos: Diese belegt nur der Prüfbestand. Kein Merkmal der echten Daten fehlt im Prüfbestand.
- `advanceRound` liest die Halbfinals ohne `orderBy`; welche Seite im Finale A ist, hängt an der Zeilenfolge. Die
  Prüfdatenbank läuft ohne Autovacuum, mit `fillfactor = 50`, und der Aufbau schreibt über eine Verbindung.

## Werkzeug

`apps/ringwerk/tools/pruefen-ringwerk.ts` mit den Modulen unter `tools/pruefen-ringwerk/` auf `@vereinsheim/pruefen`:
`targets.ts` (Wettbewerbe aus der Datenbank, nur lesend), `capture.ts` (Browser, PDFs), `normalize.ts` (Text,
Datenfolge, Starterliste), `compare.ts` (Vergleich, Gegenprobe), `report.ts`, `store.ts`, `bestand.ts`, `ablaeufe.ts` und
`ui.ts` (Bedienung), `echt.ts` (Sitzungen, Fingerabdruck), `phases.ts` (Phasen einer Datenbank).
