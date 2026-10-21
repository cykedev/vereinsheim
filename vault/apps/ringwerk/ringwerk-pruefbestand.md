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
| `… --referenz <ordner>` | Ausgangsstand in einem eigenen Ordner (Bilder darin unter `bilder/`): den alten Stand auf demselben Aufbau aufnehmen, dann den neuen dagegen vergleichen |
| `… --nur <wort>` | nur Wettbewerbe (bzw. Abläufe), deren Schlüssel das Wort enthält |

Laufzeit: Aufnahme oder Vergleich des Prüfbestands knapp 2 Minuten, Abläufe gut 3 Minuten (Telefon und Desktop
zugleich, darin 30 s Neuaufbau). Jeder Lauf nennt am Ende die Zeit je Abschnitt. Nicht im Gate: braucht
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

Der Vergleich ist über Aufbauten hinweg eindeutig: Jeder Lauf von `pruefdaten` ergibt dieselben Daten (Prüfsumme) in
derselben physischen Folge (der Aufbau schreibt über eine Verbindung, `fillfactor = 50`), und Ringwerk ordnet jede Liste
bis zu einem eindeutigen Schlüssel. Bei gleichem Namen entscheidet der Vorname, dann die `id`; Paarungen im Bracket,
Einschreibungen und Serien stehen nach `createdAt` und `id` in der Reihenfolge der Anlage (cuid: Zeitstempel, dann
Zähler), Saison-Serien am selben Tag in der Reihenfolge der Erfassung, im Finale ist der Sieger des oberen Halbfinales
A. Tests halten das fest (`src/lib/readOrder.test.ts`, `readOrderLists.test.ts`,
`src/lib/playoffs/actions/match.test.ts`). Belegt am 18. Oktober 2026: zwei Aufbauten, 0 Fehler, alle Seitenbilder
gleich.

Ordnet eine neue Abfrage nur nach einem Schlüssel, der nicht eindeutig ist, zeigt der Vergleich nach einem Neuaufbau
Vertauschungen. Er nennt dann einen anderen Aufbau als bei der Aufnahme (`build` in `_stand.json`); `--referenz`
vergleicht alt gegen neu auf demselben Aufbau.

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

## Stand 20. Oktober 2026

- Wertung richtig anzeigen (B1–B8, Plan „Ringwerk — Befunde aus dem Ablesen für die Hilfe“): drei neue Szenarien mit
  gesetzten Ergebnissen, nicht zufällig. `L-FIN-TB` (Finale bei gleichen Ringen über den Ringteiler), `L-MIX-T`
  (gemischt nach Teiler, Teiler vom Ausdruck und korrigierter entscheiden anders), `L-RINGE` (Punktgleiche, die meisten
  Ringe und der beste Ringteiler trennen verschieden); 95 Wettbewerbe. Zweimal mit Freigabe aufgenommen: auf dem alten
  Code (`ff8dfd37`, nahm auch die Beschriftungen aus WD0/WD3 auf) und nach den Korrekturen (`20b1c899`).
- Weil Ringwerk `finaleHasSuddenDeath` nicht mehr schreibt (E1), hat der neue Aufbau eine andere Prüfsumme (63 Ligen
  `null` statt `true`, `pruefdaten --zeilen` alt gegen neu: sonst nichts). Verglichen wurde deshalb alter gegen neuen
  Code auf demselben neuen Aufbau (`--referenz`, alter Stand in einem eigenen Worktree): 28 Fehler und 8 Hinweise, alle
  aus B1 (L6c in drei Formaten, `L-FIN-TB`), B3 (`L-MIX-T`, auch die Vorschau auf Start und Liste) und B6 (`L-RINGE`).
  Danach Vergleich 0 Fehler, 0 Hinweise; Abläufe grün bis auf die zwei bekannten Befunde; `pruefen` 0 FAIL von 279.
- Lücke im Bestand: Er hat keine gemischte Liga im Best-of-Format und keine Disziplin mit festem Faktor ≠ 1 in einer Liga.
  Beides decken Tests ab (`bestOfStatus.test.ts`, `standings/queries.test.ts`, `matchups/queries.test.ts`), nicht der
  Abgleich.

- Ausgangsstand neu aufgenommen auf `6b8a4ca0` (Design 2 mit den Dialogen, vom User freigegeben). Grund: Spielplan und
  nächste Runde schreiben jetzt einen Protokolleintrag, `pruefdaten` erzeugt also 72 Protokollzeilen mehr
  (54 „Spielplan generiert“, 18 „Playoff-Runde angelegt“). Belegt über `pruefdaten --zeilen` auf altem und neuem Stand:
  alle Tabellen außer `AuditLog` gleich, dort nichts entfallen. Danach Vergleich 0 Fehler, 0 Hinweise; Abläufe grün bis
  auf den bekannten Befund.
- Am selben Tag noch einmal aufgenommen auf `ef05d181` (vom User freigegeben): „Spielplan generiert“ zählt die
  Paarungen ohne Freilose. Anders waren nur 9 Protokollzeilen der Ligen mit ungerader Teilnehmerzahl (etwa 30 → 20
  Paarungen bei 5 Teilnehmern in Hin- und Rückrunde). Danach Vergleich 0 Fehler, 0 Hinweise; Abläufe grün bis auf den
  bekannten Befund.
- Seit dieser Aufnahme ist der Ausgangsstand Design 2: Hinweise zu Beschriftungen und die Bilder vorher/nachher beziehen
  sich auf Design 2. Die Bilder vor Design 2 liegen weiter unter `reports/aus-worktree-happy-leakey/ringwerk-referenz/`
  der Hauptcheckout.

## Stand 18. Oktober 2026

- Ausgangsstand vom User bestätigt, aufgenommen auf `28f34bd1` (Ringwerk wie `main`), am selben Tag mit eindeutiger
  Reihenfolge bei Gleichstand neu aufgenommen (vom User freigegeben, alle 152 Abweichungen reine Vertauschungen).
  Vergleich über zwei Aufbauten: 0 Fehler, 0 Hinweise. Gegenprobe rot.
- Abläufe: alle Schritte grün bis auf einen bekannten Befund. Nach einem Feldfehler beim Anlegen springt die
  Disziplin auf „Gemischt (Faktor-Korrektur)“ zurück. Wer nur den Namen nachträgt, legt still einen gemischten
  Wettbewerb an. Die Radix-Auswahl mit `name` folgt dem Zurücksetzen des Formulars durch React. Behoben wird das außerhalb
  von Teil R; bis dahin führt `KNOWN` in `tools/pruefen-ringwerk/ablaeufe.ts` den Befund.
- Echte Daten (11 Wettbewerbe, nur ein Admin-Konto aktiv, kein Mitglied): Vergleich 0 Fehler. Sie enthalten Liga
  Best-of-3 in L1, L2 und L7 ohne Playoffs, Freilos, Events (Ringe, Zielwert), Saisons (Teiler/Ringe abwechselnd) und
  öffentliche PDFs mit und ohne Passwort. Keine Hin/Rück-Liga, keine Playoffs, keine Teams, kein Rückzug, kein
  Kampflos: Diese belegt nur der Prüfbestand. Kein Merkmal der echten Daten fehlt im Prüfbestand.
- Die Prüfdatenbank läuft ohne Autovacuum, mit `fillfactor = 50`, und der Aufbau schreibt über eine Verbindung.

## Werkzeug

`apps/ringwerk/tools/pruefen-ringwerk.ts` mit den Modulen unter `tools/pruefen-ringwerk/` auf `@vereinsheim/pruefen`:
`targets.ts` (Wettbewerbe aus der Datenbank, nur lesend), `capture.ts` (Browser, PDFs), `normalize.ts` (Text,
Datenfolge, Starterliste), `compare.ts` (Vergleich, Gegenprobe), `report.ts`, `store.ts`, `bestand.ts`, `ablaeufe.ts` und
`ui.ts` (Bedienung), `echt.ts` (Sitzungen, Fingerabdruck), `phases.ts` (Phasen einer Datenbank).

**Chrome 155 (21. Oktober 2026):** Headless beendet sich bei `captureBeyondViewport` auf sehr hohen Seiten (Liste der
Wettbewerbe, 48.442 px) und bei `Page.getLayoutMetrics`. Zu sehen als „Chrome ist weg“ gleich nach „Build von vor …“.
Seitdem fotografiert `@vereinsheim/pruefen` ganze Seiten über ein vergrößertes Fenster, höchstens 16.000 px hoch
(`MAX_SHOT_HEIGHT`). Längere Seiten enden im Foto dort. Belegt: `main` gegen eine Aufnahme mit demselben Verfahren,
0 Fehler, 0 Hinweise. Befehle, die Chrome starten, brauchen in der Agent-Shell die Sandbox aus.
