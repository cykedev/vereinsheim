---
id: spiegel-roadmap
type: guide
title: "Spiegel — Roadmap und Features"
aliases: [spiegel-backlog, spiegel-phasen, spiegel-fahrplan]
keywords: [roadmap, backlog, fahrplan, phasen, epics, features, sp-0, sp-1, sp-2, sp-3, sp-4, abnahme, abhängigkeiten, status, piv, plan, implement, sessions, sonderfälle, testdaten, durchstich, meilenstein, schnitt, sp-0.6, sp-1.0]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-open-questions]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Spiegel wird in fünf Phasen gebaut: Erkundung, Fundament, Auswertung, Vernetzung, Weichenstellung. Jedes Feature hat eine ID (SP-x.y), ein Ziel, einen Umfang, eine Abnahme, Abhängigkeiten und einen Status und ist so geschnitten, dass es in einer Session über `/plan → /implement → /validate → /review` umgesetzt werden kann.

# Spiegel — Roadmap und Features

## So nutzen wir diese Roadmap

- **Ein Feature pro Session** (große Features in mehrere Pläne geteilt). Vor dem Start prüfen, ob die Abhängigkeiten erledigt sind.
- `/plan` bekommt den Feature-Abschnitt als Auftrag; der Plan verweist zurück auf die Feature-ID. Entscheidungen im Plan heißen D1, D2, …; E1, P3 und Co. sind Katalog-IDs ([[spiegel-statistics]]), sonst ist „E9“ doppeldeutig.
- Nach dem Merge den **Status** hier nachziehen (offen → in Arbeit → erledigt) und Erkenntnisse in die Fach-Notes schreiben ([[spiegel]]).
- Features mit Deploy-Vertrag, Schema oder ADRs laufen interaktiv ([[autopilot-guard-blocks-contract-only-plans]]).
- **Früh startbar ohne Erkundung:** SP-1.0, SP-1.1, SP-1.2 und SP-1.3 sind reine Paketarbeit und hängen nicht an der Anlage.
- **Sonderfälle:** Jede Abnahme nennt die SF-IDs aus [[spiegel-edge-cases]], die das Feature abdecken muss; die Testdaten dafür liefert SP-1.0. Ein neuer Sonderfall bekommt erst eine ID im Katalog, dann einen Test.
- **Zu groß für eine Session** sind SP-1.4, SP-1.6 und SP-1.7; ihr Abschnitt nennt den Schnitt in Teil-Pläne (a, b, c).

## Phase 0 · Erkundung

Ziel: Fakten über unsere Anlage, bevor wir Annahmen in Code gießen.

### SP-0.1 SSMDB2 vor Ort erkunden
- **Ziel:** wissen, was in unserer Ablage steht.
- **Umfang:** SQL-Checkliste aus [[meyton-ssmdb2]] vor oder nach einem Trainingsabend: Struktur, Engine, Indizes und Abfragekosten, Spaltentypen, Wertungsmodi je Disziplin, mehrdeutige SportpassIDs, Disziplin-Varianten, `--frei--`-Scheiben; dazu, ob das Gerätenetz ausgehend Internet hat. Die Versuche am Stand folgen im Schießprotokoll (SP-0.6) am selben Abend. Der SSMDB2-Dienst ist aktiv. Fragen: Landen Trainings ohne Starter in der Ablage (den QR gibt es immer, ohne Ablage gäbe es aber nur das PDF-Ergebnis)? Skalen der Ring-Felder? Achsenrichtung? Teiler-Einheiten? Wie weit reicht die Historie? Bleiben Probeschüsse nach der Wertung? Größte SportpassID (Überlauf)? Uhrabweichung? Liegen die PDF-Ausdrucke auch auf der Freigabe `ERGEBNIS`?
- **Abnahme:** Antworten (ohne Namen) in [[meyton-ssmdb2]], [[spiegel-open-questions]] und [[spiegel-edge-cases]] eingetragen; Sonderfälle, die sich bestätigen oder erledigen, dort nachgezogen.
- **Hängt ab von:** nichts. **Status:** erledigt (9. Oktober 2026): Checkliste und Kopie nach einem Trainingsabend ([[src-ssmdb2-kopie-2026-10-09]]); Antworten in [[meyton-ssmdb2]], [[spiegel-open-questions]] und [[spiegel-edge-cases]]. Offen nur: ob das Gerätenetz sicher selbst Internet hat (ein Gateway im Meyton-Netz lieferte es, die Schnittstelle ist unklar) und ob Ausdrucke auf der Freigabe `ERGEBNIS` liegen (als Gast abgelehnt).

### SP-0.2 QR-ID prüfen
- **Ziel:** bestätigen, dass die ID im Fuß des Ausdrucks die ScheibenID ist (den QR gibt es laut Verein immer).
- **Umfang:** Abfrage aus [[meyton-printout]] mit `ff914420` → −7257056; dazu eine Scheibe ohne Starter schießen, ihren QR scannen und die ID nachschlagen. Prüfen, ob Meyton kleine IDs mit führenden Nullen auf acht Zeichen füllt (alle drei bekannten liegen über 0x10000000; sonst wären sie für das Muster unsichtbar).
- **Abnahme:** [[adr-028]] bestätigt oder angepasst.
- **Hängt ab von:** SP-0.1 (gleicher Abend). **Status:** zum großen Teil erledigt (9. Oktober 2026): ID im Fuß = ScheibenID, in [[adr-028]] bestätigt. Offen: Scheibe ohne Starter, führende Nullen bei IDs unter 0x10000000.

### SP-0.3 Messlatte DISAG M-Qnect (optional)
- **Ziel:** sehen, was die ShotsApp mit unserer Anlage kann.
- **Umfang:** M-Qnect auf einem Android-Tablet im Meyton-Netz testen ([[meyton-interfaces]]).
- **Abnahme:** kurze Notiz in [[spiegel-vision]], was Spiegel besser machen muss. **Status:** offen.

### SP-0.4 Technik der Brücke entscheiden
- **Ziel:** Sprache und Auslieferung festlegen.
- **Umfang:** Go-Binary gegen Bun- oder Deno-Binary gegen Docker mit Node; Kriterien: eine Datei ohne Laufzeit, Raspberry Pi und Windows, Stromverlust, Selbst-Update, geteilter Vertrag. Empfehlung: Go mit „dummer“ Brücke ([[spiegel-bridge]]). Dazu der Ort: eigenes Gerät (ADR-027) oder direkt auf dem Meyton-Rechner unter SUSE Linux ([[spiegel-open-questions]]).
- **Abnahme:** Ergänzung in [[adr-027]]. **Status:** Technik erledigt: Go, ein statisches Binary ([[adr-027]]). Der Ort ist offen; das Binary läuft auf beiden.

### SP-0.5 Einwilligung und Datenschutz
- **Ziel:** rechtlich sauberer Start.
- **Umfang:** Einwilligungstext (Opt-in per Sportpass), Verantwortlicher, Auftragsverarbeitung mit dem Hoster; vorerst nur erwachsene Mitglieder, keine Gäste ([[spiegel-privacy]]).
- **Abnahme:** Text vom Vorstand abgestimmt. **Status:** entfällt: Einen Einwilligungstext vom Vorstand gibt es nicht. Der Schütze bestätigt beim Opt-in einen versionierten Hinweistext von Spiegel selbst (SP-1.7 a, [[spiegel-privacy]]).

### SP-0.6 Schießprotokoll mit Mitschnitt
- **Ziel:** sehen, wie sich die Ablage bei den Sonderfällen wirklich verhält, und Testdaten ableiten, die der Anlage gleichen.
- **Umfang:** Ein kleines Skript liest wie die Brücke, nur lesend, und schreibt jeden Zustand mit Zeit in ein Protokoll; Namen und SportpassIDs ersetzt es schon beim Mitschreiben. Dazu schießen wir mit der Standaufsicht das Schießprotokoll aus [[meyton-ssmdb2]] (Probe → Wertung → Probe, lange Probe, nur Probe, Abbruch, ohne Starter, Zwischen- und Doppelausdruck, Korrektur, falsche Disziplin, verdeckte Wertung) und sichern `SHOW CREATE TABLE` aller Tabellen. Ins Repo kommt nur das Schema; das Protokoll bleibt lokal und dient als Vorbild für synthetische Daten ([[adr-029]]).
- **Abnahme:** jeder Versuch mit Ergebnis in [[meyton-ssmdb2]] und [[spiegel-edge-cases]] eingetragen; Schema im Repo; Protokoll ohne Namen und Nummern.
- **Hängt ab von:** SP-0.1 (gleicher Abend). **Status:** zum großen Teil erledigt (9. Oktober 2026): Statt des geführten Protokolls lief ein Mitschnitt über einen ganzen Trainingsabend (Phase `abend` von [[ssmdb2-erkundung]]), dazu ein Ausdruck ([[src-ssmdb2-abend-2026-10-09]]). Belegt: Probe wird beim Umschalten und beim Neustart gelöscht, zerrissene Lesungen, Lebenszeichen, Uhr je Stand, Anzeigeart, Meytons Toleranz von 10 µm; eingetragen in [[meyton-ssmdb2]], [[spiegel-edge-cases]] und [[adr-027]]. Offen und **nicht nötig** für Brücke und Spiegel (bei Gelegenheit am Stand): Weg zurück auf Probe, Auslöser des Probe-Neustarts, ohne Starter, Zwischen- und Doppelausdruck, Korrektur, falsche Disziplin, verdeckte Wertung. Das echte Schema liegt mit der Kopie vor (SP-0.1). **Die Erkundung der Daten ist damit abgeschlossen.**

## Phase 1 · Fundament

Ziel: **Mit Opt-in erscheint die Dienstagsscheibe von selbst in Spiegel; ohne Opt-in reicht der Meyton-QR.** Beide Male mit denselben Schüssen wie am Ausdruck: bei Wertung die Wertung, bei reiner Probe die Probe (SF-03, SF-72; [[adr-027]], Entscheidung vom 9. Oktober 2026).

**Meilenstein Durchstich:** Bevor Zuordnung und Oberfläche entstehen, läuft eine echte Scheibe einmal durch: SP-1.0a, SP-1.4a/b und SP-1.6a/b in der einfachsten Form, mit festem Filter auf die eigene SportpassID. Am Trainingsabend erscheint die Scheibe roh in Spiegel, wie am Ausdruck. Gemessen werden Latenz, Abfragekosten auf der Anlage, Speicher je Scheibe und der Speicher des leeren Skeletts unter der 256-MB-Grenze, an der [[adr-026]] hängt. Was dabei überrascht, ändert den Plan, solange er noch billig zu ändern ist.

### SP-1.0 Vertrag und Sonderfall-Testdaten
- **Ziel:** Brücke und Spiegel haben einen festen Vertrag, und jeder Sonderfall ist für beide reproduzierbar.
- **Umfang:** `packages/ingest-contract` mit JSON-Schema, kanonischer Serialisierung und Testvektoren für die Prüfsumme sowie Beispiel-Snapshots; dazu MySQL im Docker mit dem Schema aus SP-0.6 (bis dahin nach Handbuch) und ein Generator, der je SF-ID Zeilen erzeugt, auch als Abfolge von Zuständen (Probe verschwindet, Korrektur, Reset). Dieselben Fälle dienen als Snapshots für Ingest-Tests und als kanonische Scheiben für die Oberfläche ([[spiegel-edge-cases]]). Nur synthetische Daten.
- **Schnitt:** a) Vertrag mit Testvektoren; b) Generator und MySQL-Fälle.
- **Abnahme:** Brücke und Spiegel rechnen dieselben Prüfsummen; jede SF-ID mit Datenbezug hat einen Fall; Sonderfälle SF-27, SF-69.
- **Zuschnitt b):** eigenes Paket `packages/ssmdb2-cases` (`@vereinsheim/ssmdb2-cases`) (der Vertrag kennt keine Meyton-Spalten). Je Sonderfall mit SSMDB2-Bezug (rund 30: SF-01 bis 05, 72; SF-07 bis 11, 13; SF-14 bis 23, 71, 74; SF-30, 73, 77, 78; SF-35, 36) eine erfundene Ablage im echten Schema der Kopie vom 9. Oktober 2026 als Folge von Ständen, gebaut mit einem Baukasten für das beobachtete Verhalten (Probe beim Umschalten und Neustart gelöscht, Lebenszeichen, Anzeigeart, zerrissene Lesung, Korrektur, Schuss über Soll mit Platzhalter-Teiler, Uhr je Stand, ScheibenID als Zeitzähler, `unknown`/„Trash“). Je Fall drei Ausgaben: Snapshots v1, SQL je Schritt, erwartetes Ergebnis (Merkmale, zählende Schüsse, wie am Ausdruck) als Vorgabe für SP-1.6; eingefroren unter `cases/v1/<SF-ID>/`, damit auch eine Brücke in Go sie liest, ein Test hält sie aktuell. MySQL-Fälle: eigener Befehl mit `mariadb:11` und dem echten Schema, spielt jeden Fall ein und prüft nach jedem Schritt das Lesen wie die Brücke; nicht im `pnpm check`. **Echte Daten** dazu nur eigene, mit Zustimmung ([[adr-029]]): als Fixture in `packages/shot-core` alle 36 Scheiben eines Mitglieds von Oktober 2024 bis Oktober 2026, 969 Schüsse, ohne Name, ID und Zeit; mit Datum und Schusszeiten für `seed:own` in `apps/spiegel/tools/own-cards-data.ts`.
- **Hängt ab von:** nichts. **Status:** erledigt. a) `packages/ingest-contract` ([[spiegel-ingest-contract]]): Snapshot v1 mit Prüfsumme nach RFC 8785, Testvektoren aus einer unabhängigen Python-Implementierung, eingefrorene Beispiele. b) `packages/ssmdb2-cases`: 31 Fälle (der Zuschnitt und SF-32) im echten Schema der Kopie unter `cases/v1/<SF-ID>`, mit Snapshots, SQL je Schritt und erwartetem Ergebnis; `pnpm --filter @vereinsheim/ssmdb2-cases replay` spielt sie in `mariadb:10.6` (wie an der Anlage) und `mariadb:11` ab. Annahmen, weil nicht beobachtet, bis das Schießprotokoll (SP-0.6) sie klärt: Probe nach dem Wechsel zurück (SF-04), Korrektur und Löschen mit Nachrücken ohne neues Lebenszeichen (SF-21, SF-22; eine Brücke, die nur bei neuem Lebenszeichen liest, findet sie erst beim Abgleich der letzten Tage), eigene Serie über der Soll-Zahl, `Text` bei Anzeigeart 0 und 10 und beim Fehlschuss, „Hand“ beim Handeintrag. Nicht hier: SF-25 (Spalte mehr oder weniger) braucht ein geändertes Schema und gehört in die Tests von Brücke (SP-1.4) und Adapter (SP-1.6, Quarantäne); SF-27 und SF-69 der Abnahme gehören zum Vertrag (a).

### SP-1.1 Fachkern: Scheibenbilder und Wertung
- **Ziel:** Scheiben korrekt zeichnen und werten.
- **Umfang:** `packages/shot-core`: Datenformat Scheibenbild; Bibliothek für eure 10-m-Stände, also Luftgewehr und Luftpistole (Auflage nutzt dieselben Scheiben), weitere Scheiben erst bei Bedarf; Regelkatalog DisziplinID → Regel (DSB und Meyton-eigen) → Scheibenbild, über Regelnummer und Schusscode mit Rückfall auf LG/LP als Wort im Namen, sonst Vorschlag per Gegenprobe mit Admin-Bestätigung; Disziplin-Familien; Neu-Wertung mit anderem Scheibenbild; Wertungsformel mit Innenzehner ([[spiegel-target-library]]).
- **Abnahme:** Gegenprobe reproduziert alle bekannten Meyton-Werte; Mutationsprobe nach [[conventions]] §9; Sonderfälle SF-09, SF-14, SF-16, SF-17, SF-18, SF-70.
- **Hängt ab von:** nichts. **Status:** erledigt (`packages/shot-core`), mit Meytons Toleranz von 10 µm an jeder Grenze (SF-75; ohne sie weichen 1.351 von 43.000 Schüssen der zweijährigen Historie um ein Zehntel ab, mit ihr keiner), Rundung wie im Ausdruck (SF-76) und dem Katalog für Vereinsspiele und Meytons Trainingsscheiben (SF-70).

### SP-1.2 Fachkern: Geometrie und Kennzahlen-Registry
- **Ziel:** die Rechenbasis für alle Auswertungen.
- **Umfang:** Schwerpunkt, kleinster Kreis, mittlerer Radius, Streuung, Intervalle; `defineMetric` mit Version und Ebenen; die ersten rund zehn Kennzahlen ([[spiegel-metrics]]).
- **Abnahme:** Eigenschafts- und Mutationstests; isomorph (Server und Client); Sonderfälle SF-01, SF-14, SF-60, SF-61, SF-62, SF-63.
- **Hängt ab von:** SP-1.1. **Status:** erledigt (`packages/shot-core`: `geometry`, `time`, `metrics`).

### SP-1.3 Meyton-PDF: ID und Druckzeit
- **Ziel:** QR-Zuordnung ohne Abhängigkeit vom Layout des Ausdrucks ([[adr-028]], Änderung vom 6. Oktober 2026).
- **Umfang:** `packages/meyton-pdf`, zunächst klein: aus einem PDF (Bytes) die ID im Fuß (`ID:` und acht Hex-Zeichen, auf allen Seiten, dekodiert als vorzeichenbehaftete 32-Bit-Zahl) und die Erstellzeit aus den Metadaten (mit Zeitzone) lesen; DoS-Grenzen für Größe und Seiten. Test-PDFs synthetisch, ohne Namen, auch mit abgewandeltem Layout.
- **Abnahme:** ID und Erstellzeit aus dem Beispiel-Format und aus abgewandelten PDFs (anderes Layout, mehrseitig, Probe-Ausdruck) gelesen; ohne ID oder Metadaten ein sauberes „nicht gefunden“; Sonderfälle SF-44, SF-46, SF-48.
- **Hängt ab von:** nichts. **Status:** erledigt (`packages/meyton-pdf`); die Grenzen greifen nur zwischen den Schritten von pdf.js, den Schutz gegen präparierte PDFs bringt der Kindprozess in SP-1.7 b.

### SP-1.4 Brücke v1: lesen, puffern, hochladen
- **Ziel:** Rohdaten kommen verlässlich aus dem Schützenhaus.
- **Umfang:** `apps/spiegel-bridge` nach [[spiegel-bridge]], ohne eigenen Zustand ([[adr-027]], Änderung vom 8. Oktober 2026): Kopplung, Leser mit Read-only-Transaktionen, Änderungserkennung, Snapshots mit Prüfsumme, Upload mit Wiederholung statt Warteschlange, Heartbeat, Statusseite; ohne Probe-Puffer, Snapshot erst nach zwei gleichen Lesungen, Änderungen je ScheibenID über den zuletzt gesehenen Zeitstempel ([[adr-027]], Änderung vom 9. Oktober 2026); Betrieb mit Abschalten nach dem Training (Nachholen beim Start ab dem Wasserstand in Spiegel).
- **Schnitt:** a) Leser, Änderungserkennung und Snapshots, nur lokal; b) Kopplung, Upload und Heartbeat; c) Nachholen beim Start, Updates, Statusseite.
- **Abnahme:** gegen eine lokale MySQL mit SSMDB2-Schema und den Fällen aus SP-1.0, Ausfalltests (Netz weg, DB weg, Stecker ziehen während des Uploads; danach nichts auf der Platte außer der Konfiguration), einmal an der echten Anlage; Sonderfälle SF-02, SF-03, SF-07, SF-08, SF-10, SF-23, SF-24, SF-25, SF-26, SF-31, SF-32, SF-33, SF-49, SF-50, SF-51, SF-52, SF-53, SF-54, SF-55, SF-57, SF-58.
- **Hängt ab von:** SP-0.4, SP-1.0. **Status:** a) und b) erledigt (`apps/spiegel-bridge`, [[spiegel-bridge]]): Leser in Go mit Änderungserkennung und Snapshots, abgenommen an allen 31 Fällen (`pnpm --filter spiegel-bridge replay`); `pair` und `run` mit Upload ohne Warteschlange und Heartbeat, Ende zu Ende gegen den eigenen Build (`pnpm --filter spiegel bridge-e2e`). c) zum Teil erledigt: Nachholen beim Start, nur wenn niemand schießt (SF-52, SF-55), Dienst für systemd mit Installationsskript. Offen: Selbst-Update (SF-54), Dienst unter Windows, Statusseite (laut [[spiegel-bridge]] nicht nötig), eine neue Epoche bei einem Reset, ein Abgleich während eines langen Laufs; einmal an der echten Anlage.

### SP-1.5 Brücke v1: Opt-in, Aufträge, verdeckte Wertung
- **Ziel:** nur das Richtige verlässt das Schützenhaus.
- **Umfang:** Liste gehashter SportpassIDs mit Opt-in, Live-Upload passender Scheiben; Aufträge per Abfrage (Vorschau und Scheibe per ID, Fundbüro-Liste, Nachladen); Grabsteine; Modus 5 und 10 nie, Modus 0 erst nach Freigabe je Disziplin.
- **Abnahme:** Tests zu Filter, Verdeckung und Aufträgen; keine Scheibe ohne Opt-in oder Auftrag verlässt das Gerät; Sonderfälle SF-13, SF-19, SF-20, SF-28, SF-38, SF-41, SF-59.
- **Hängt ab von:** SP-1.4. **Status:** Filter erledigt: Zustimmung, Verdeckung (5, 10, Modus 0 ohne Freigabe), Grabsteine und Löschsperren, ohne Zustand kein Upload (SF-13, SF-19, SF-20, SF-28, SF-38, SF-59); das Nachladen ist erledigt (SP-2.5). Offen: Aufträge (Vorschau und Scheibe per ID, Fundbüro; SF-41), Freigabe von Modus 0 je Disziplin.

### SP-1.6 Spiegel-App: Skelett, Ingest-API, Normalisierung
- **Ziel:** Spiegel nimmt Daten an und versteht sie.
- **Umfang:** `apps/spiegel` nach Vereinsheim-Muster (Auth, Admin, Rate-Limit), Design-2-Tokens, Datenmodell ([[spiegel-data-model]]), Ingest-API mit Geräte-Token und Vertrag in `packages/ingest-contract`, Rohdaten-Store, Adapter `meyton-ssmdb2@9` mit Skalen, Zeitzone, Epochen, Revisionen ([[spiegel-ingest-pipeline]]).
- **Schnitt:** a) App-Skelett, Datenmodell und Design-2-Tokens, Speicher des leeren Skeletts lokal unter `mem_limit` 256 MB gemessen; b) Ingest-API, Rohdaten-Store als Zeilenversionen und Adapter.
- **Abnahme:** Snapshot rein → kanonische Scheibe raus, auch bei Korrektur und Epochenwechsel; `/check` grün; Sonderfälle SF-01, SF-02, SF-03, SF-04, SF-07, SF-08, SF-09, SF-15, SF-21, SF-22, SF-23, SF-25, SF-26, SF-28, SF-29, SF-30, SF-31, SF-59, SF-67, SF-69.
- **Hängt ab von:** SP-1.0, SP-1.1. **Status:** erledigt bis auf die Aufträge. a) `apps/spiegel` (Next 16, Prisma 7, Design-2-Tokens, Dev-Port 3002) mit Rohdaten als Zeilenversionen, Revisionen und Projektion je Scheibe ([[adr-031]], [[spiegel-db-schema]]), Anmeldung wie Ringwerk, Kontenverwaltung für Admins und eigenem Passwort ([[spiegel-privacy]]); Speicher unter 256 MB gemessen ([[spiegel-db-schema]]). b) Ingest-API v1 mit Kopplung, Snapshots, Heartbeat und Zustand, Adapter `meyton-ssmdb2@9` an allen 31 Fällen abgenommen, Epochen, Admin-Seite „Anlage und Brücken“, Lastskript `ingest-load` ([[spiegel-ingest-pipeline]]). Offen: Aufträge (`commands`, mit SP-1.5 und SP-1.7).

### SP-1.7 Zuordnung: Opt-in per Sportpass, Meyton-QR, Admin
- **Ziel:** jede Scheibe findet ihren Besitzer ([[spiegel-assignment]]).
- **Umfang:** Profil mit Sportpass-Opt-in, Admin-Bestätigung und Bestätigung der ersten Scheibe (die SportpassID pflegt der Admin bei Interessierten vorher in der Meyton-Schützenverwaltung nach); QR erfassen (Kamera im Browser, Link, „Teilen“ auf Android); PDF von erlaubten Adressen laden und als Original speichern; ID und Druckzeit lesen (SP-1.3); Auftrag an die Brücke, auch zurückgestellt, wenn sie aus ist; Vorschau mit Druckzeit-Plausibilität und Bestätigung; Auswahl nach Druckzeit ohne ID; PDF an vorhandene Scheiben hängen; Admin-Zuweisung; „Nicht meine“; Protokoll.
- **Schnitt:** a) Opt-in mit erster Bestätigung; b) QR-Weg mit PDF, Auftrag, Vorschau und Bestätigung; c) Admin-Zuweisung, „Nicht meine“, Teilen und Protokoll.
- **Abnahme:** Opt-in-Scheibe erscheint ohne Zutun; QR-Weg mit einem anonymisierten Ausdruck lokal und an der Anlage; QR-Scan bei ausgeschalteter Brücke ergibt ein PDF-Ergebnis, das beim nächsten Start vollständig wird; PDFs liest der Server nur in einem kurzlebigen Kindprozess mit Speichergrenze und hartem Abbruch, präparierte PDFs bringen ihn nicht zu Fall; Sonderfälle SF-12, SF-28, SF-34, SF-35, SF-37, SF-38, SF-39, SF-40, SF-41, SF-42, SF-43, SF-45, SF-47, SF-48, SF-56.
- **Hängt ab von:** SP-1.3, SP-1.5, SP-1.6 (a nur SP-1.6). **Status:** in Arbeit. a) erledigt ([[spiegel-assignment]]): Der Schütze stimmt im Profil dem Hinweistext zu, ein Admin bestätigt oder lehnt ab; neue Scheiben warten bis zur Bestätigung der ersten in „Offen“ („Ja, meine“, „Nicht meine“); Scannen ist bis zum QR-Weg aus der Navigation genommen. **Der QR-Weg hat Priorität eins:** b mit den Aufträgen aus SP-1.5 und SP-1.6, Scannen und dem PDF-Volume samt Backup. c offen.

### SP-1.8 Scheiben-Liste und Session-Detail
- **Ziel:** das, was der Prototyp verspricht.
- **Umfang:** Liste nach Trainingsabend; Session-Detail mit Trefferbild (Overlays, Zoom), Serien und Probe-Blöcken als kleine Scheiben, Schusstabelle, Wiedergabe, Kennzahl-Kacheln, Bereich „Analyse“ mit den Auswertungen aus SP-1.10, Beobachtung, Original-PDF, Merkmalen und Aktionen an der Scheibe ([[spiegel-ui-design]]); Umschalter ganze Ringe/Zehntel überall; Zeichenregeln aus „Zeichnen der Scheibe“; `packages/shot-ui`.
- **Abnahme:** Sichtprüfung in der App, für Bildschirme ohne Vorbild gegen `vault/_attachments/spiegel-konzept.html`, auf Handy und Desktop, dunkel und hell; Markup-Tests; Skriptprüfung der App (`pnpm --filter spiegel pruefen`) grün; Sonderfälle SF-01, SF-02, SF-05, SF-07, SF-11, SF-16, SF-18, SF-61.
- **Hängt ab von:** SP-1.2, SP-1.6, SP-1.11 (Hilfe an jeder Zahl). **Status:** in Arbeit. In `apps/spiegel` stehen Start, Scheiben-Liste, die Seite einer Scheibe (Scheibe mit Ebenen und Ausschnitt, Serien, Kacheln, Schusstabelle, Analyse in Reitern, Hilfe an jeder Zahl; [[spiegel-ui-design]], [[spiegel-mobile]]), Fortschritt, Offen und Profil mit Papierkorb ([[spiegel-navigation]]), gebaut aus `packages/shot-ui`. Start, Liste und Blättern rechnen auf der Projektion ([[adr-031]]): Bei 1.564 Scheiben gehen an den Browser 5 KB (Start) bzw. 1 MB (Liste „Alles“) statt 8 MB ([[spiegel-db-schema]]). Eine Scheibe lässt sich per Link teilen (`/share/<uuid>`, ohne Anmeldung, nur Ansicht; [[spiegel-navigation]] „Teilen per Link“). Offen: Auswahl in der Liste (vergleichen, ausnehmen, löschen), Vergleich zweier Scheiben, freier Zoom, Wiedergabe; Scannen kommt mit SP-1.7 b.

### SP-1.9 Betrieb: Deploy und Selbst-Hosting
- **Ziel:** Spiegel läuft auf dem VPS und ist für andere Vereine betreibbar.
- **Umfang:** dritte DB und Owner mit idempotentem Anlage-Schritt, `app-spiegel` und `migrate-spiegel` in `compose.yml`, Caddy-Subdomain und Ingest-Endpunkt, Backups inklusive PDF-Speicher, CLI; ohne VPS-Upgrade: `mem_limit` für Spiegel (Ziel 256 MB), Deploys nacheinander, Messung von Ruhe- und Deploy-Spitze auf dem VPS S mit 2 GB ([[adr-026]]); Compose-Beispiel und Doku für Selbst-Hoster ([[adr-029]]).
- **Abnahme:** Deploy auf dem VPS, Speicher bleibt in Ruhe und beim Deploy unter der Grenze, Restore-Probe, Selbst-Hosting-Beispiel startet lokal; Sonderfälle SF-67, SF-68.
- **Hängt ab von:** SP-1.6; Start und Liste auf der Projektion (SP-1.8); SP-1.7 a (der Hinweistext verspricht die Bestätigung der ersten Scheibe). Geschützte Pfade, interaktiv. **Status:** a) erledigt, **deployt am 14. Oktober 2026** auf der Spiegel-Subdomain: Image aus dem Root-`Dockerfile` (`cyke/spiegel` auf Docker Hub), `migrate-spiegel` und `app-spiegel` in `compose.yml`, Caddy mit `X-Real-IP` und 5 MiB Anfragegröße ([[caddy-x-real-ip-passthrough]]), dritte DB über `db-init` und `scripts/db-ensure.sh`, Grenzen für alle Apps ([[vps-resource-sizing]]); das CLI kennt Spiegel bei Deploy, Backup, Restore, `restore-probe`, `setup` und Rollback ([[operations]]); lokal Ende zu Ende mit `tools/stack-e2e/run.sh` (mit `--ops` für das CLI). Die ersten Scheiben kamen aus der Kopie der SSMDB2 vom 9. Oktober 2026 über eine Brücke auf dem Mac. Offen: die Brücke im Schützenhaus (Raspberry Pi 3 B+, `linux/arm64` bei 64-Bit-OS); b) Selbst-Hosting (Compose-Beispiel, Doku).

### SP-1.10 Fachkern: Analyse einer Scheibe
- **Ziel:** alles, was eine einzelne Scheibe hergibt, als Profi-Analyse rechnen, ohne Datenbank und ohne Historie ([[spiegel-statistics]]).
- **Umfang:** `shot-core` bekommt Statistik-Hilfen (`stats`: Quantile, MAD, Wilson, χ²- und F-Quantile, c4, Theil-Sen) und das Modul `analysis`: Ergebnis (Ringverteilung, Zehntelverteilung, bester und schwächster Schuss, Teiler-Schnitt und -Listen, Ringverlust, Konstanz, Quoten), Präzision (Rayleigh-σ mit Vertrauensbereich, Höhe und Breite, Form, Ringbreiten, Ausreißer), Lage (Hotelling-Test „ist die Lage echt?“, Ringverlust durch Lage gegen Streuung, Lageanteil, Richtungsuhr, Drift), Zeit (Tempo-Konstanz, Netto-Schießzeit, Wiedereinstieg nach Pausen, Rhythmus-Profil), Verlauf (Serienkurve, Ermüdung, Trend in der Scheibe, gleitender Schnitt, Streuung und Schwerpunkt je Serie, längste Folge), Probe (Umfang, Qualität, „eingeschossen?“) und Datenlage; neue Kennzahlen in der Registry (σ̂, Höhe, Breite, Zehnerquote, Tempo-Streuung, Dauer).
- **Abnahme:** feste Erwartungswerte aus Tabellen und Hand-Rechnung, Mutationsprobe nach [[conventions]] §9; Sonderfälle SF-01, SF-14, SF-15, SF-30, SF-60, SF-61, SF-63.
- **Hängt ab von:** SP-1.2. **Status:** erledigt (`packages/shot-core`: `stats`, `analysis`; Ausreißer und Form wie in [[spiegel-statistics]], jede wertbasierte Auswertung in beiden Wertungen).

### SP-1.11 Hilfe und Erklärungen
- **Ziel:** Jede Zahl in Spiegel ist erklärt, für Einsteiger wie für Profis, in der App wie in der Doku.
- **Umfang:** Erklärtexte als Daten aus **einer** Quelle für App und Doku, neben Kennzahlen und Auswertungen (entschieden: eigenes Paket `packages/shot-help`): je Eintrag ein Satz für die Kachel, die Erklärung „Was / So liest du es / Was du tun kannst / Vorsicht“ und auf Wunsch die Formel. Dazu Glossar, Einstieg „So liest du die Analyse“ (n, 95-%-Bereich, echt/unklar, ganze Ringe/Zehntel) und typische Fehlschlüsse. In der Oberfläche ein „?“ an jeder Kachel und Karte, Erklärung auch bei „–“ (Mindestzahl) und „unklar“ ([[spiegel-ui-design]]). Die Texte stehen in `@vereinsheim/shot-help`; [[spiegel-statistics-help]] wird daraus erzeugt, die App zeigt sie am „?“.
- **Abnahme:** Ein Test erzwingt für jede Kennzahl der Registry und jede Auswertung einen Hilfetext (wie der Paar-Test der Wertungen); Sichtprüfung auf Handy und Desktop; Leseprobe mit jemandem, der die Statistik nicht im Detail kennt.
- **Hängt ab von:** SP-1.10. **Status:** erledigt (`packages/shot-help`: 24 Themen, Einstieg, Glossar, typische Fehlschlüsse; Tests gegen `METRICS` und `ANALYSIS_CATALOG` aus `shot-core`; ein Test hält den Vault-Leitfaden gleich). Das „?“ steht in der App an jeder Kachel und Karte.

### SP-1.12 Statistik straffen und Erklärungen berichtigen
- **Ziel:** Jede Zahl in Spiegel beantwortet eine eigene Frage, und jede Erklärung stimmt.
- **Umfang:** Drei unabhängige Prüfungen (Hilfe gegen Code, Zahlen per Simulation, Nutzen und Redundanz); entfernt nach Stufe 1 + 2 (E6, E7, P3, P7, L5, Netto-Zeit und Schüsse je Stunde, längste Pause, Sprünge in L8, Verhältnis Ø Abstand/R50; E9 in L4, S1 in S4, V7 neu als Kosten der markierten Ausreißer, P9 als R50/W); Code-Fehler behoben (Trend nach Mann-Kendall mit Bindungen, Lage-Verlust per Leave-one-out); alle Texte berichtigt, Trefferbild und Vertrauensellipse erklärt; Belege per `pnpm --filter @vereinsheim/shot-help simulate` ([[spiegel-statistics]], „Belege aus Simulationen“).
- **Abnahme:** Tests gegen entfernte IDs (Rückwärtstest), Mutationsproben, Leseprobe.
- **Hängt ab von:** SP-1.11. **Status:** erledigt. Stufe 3 (auf der Scheibe ausblenden, was dort nur Zufall zeigt) gehört zur Gestaltung in SP-1.8.

### SP-1.13 Erstbefüllung aus einer Kopie der Ablage (Vorschlag)
- **Ziel:** Wer startet, sieht nicht eine leere App, sondern seine Scheiben der letzten Jahre. Anlass: Die Kopie vom 9. Oktober 2026 enthält zwei Jahre Historie ([[src-ssmdb2-kopie-2026-10-09]]).
- **Umfang:** Ein Werkzeug liest eine Kopie (`erkunden.sh dump`) aus einer lokalen MariaDB und macht daraus Snapshots nach dem Vertrag ([[spiegel-ingest-contract]]), nur für Scheiben mit Opt-in, also gehashten Sportpassnummern zustimmender Schützen; Spiegel nimmt sie über dieselbe Ingest-API an wie Lieferungen der Brücke. Damit läuft der ganze Weg einmal mit echten Daten, bevor die Brücke steht. Die Kopie bleibt lokal ([[adr-029]]).
- **Grenzen:** Scheiben vor September 2026 haben keine Probe; Vereinsspiele und Meytons Trainingsscheiben ohne Scheibenbild (SF-70); verdeckte Scheiben (Königsschießen, Modus 5) nie (SF-19).
- **Hängt ab von:** SP-1.6, SP-1.7. **Status:** überflüssig: Die Brücke lädt die älteren Scheiben
  jeder bestätigten Zustimmung selbst nach (SP-2.5), soweit die Ablage sie hat.

## Phase 2 · Auswertung

### SP-2.1 Verläufe und Rekorde
- **Umfang:** Verlauf jeder Kennzahl je Disziplin-Familie mit Filtern und gleitendem Schnitt, Rekorde je Wertung (ganze Ringe, Zehntel), Kalender ([[spiegel-metrics]]); aus dem Katalog ([[spiegel-statistics]]) T1, T2, T5–T7, R1–R8, R10, R11, V3–V5; für Verläufe über unterschiedliche Schusszahlen σ̂ statt Streukreis; Sonderfälle SF-60, SF-64, SF-65, SF-66. Seite und Bedienung: [[spiegel-langzeit]]. **Hängt ab von:** SP-1.2, SP-1.8, SP-1.10. **Status:** T1, T2, T5, T6, R1–R8, R10 und R11 erledigt (`shot-core/analysis`), als Seite eines Zeitraums im Fortschritt (`shot-ui/period`); T7 (Kalender) erledigt: im Fortschritt „Wochen | Kalender“, Trainingstage je Abend, Wettkampf golden, ein Tag führt an seinen Abend in der Liste. V3–V5 offen.

### SP-2.2 Direkte Vergleiche und Beobachtungen
- **Umfang:** Serie, Scheibe, Zeitraum, Merkmal, Baseline; Sätze aus Kennzahlen nach den Regeln für ehrliche Zahlen; aus dem Katalog C1–C6 (C5 und C6 nach SP-2.3) und die Beobachtungen in Worten ([[spiegel-statistics]]). **Hängt ab von:** SP-2.1. **Status:** C3, C4 und T3 erledigt, als Vergleich zweier Zeiträume im Fortschritt. Konzept vom 21. Oktober 2026: Alle Vergleiche ziehen auf eine eigene Seite „Vergleichen“ (A gegen B, [[spiegel-vergleichen]]), C2 und W1 kommen dort hin (Plan 2 der Reihe unter SP-2.7); der Rest offen.

### SP-2.3 Notizen, Tags, Ausrüstung
- **Umfang:** Kontext an Scheibe und Serie, Grundlage für Vergleiche nach Merkmal (Munitionslos, Griff). Ein Ereignis „Visier verstellt“ gibt es nicht ([[spiegel-open-questions]]). **Hängt ab von:** SP-1.8. **Status:** offen.

### SP-2.4 Fundbüro und Check-in (bedingt)
- **Umfang:** „Scheibe holen“ am Abend als Rückfall für verlorene oder abgelaufene QR-Links, Frist sieben Tage, kein Tablet; optional Check-in per Stand-Aufkleber. Weil es den QR immer gibt, wahrscheinlich nur in kleinem Umfang nötig ([[spiegel-assignment]]). **Hängt ab von:** SP-1.7. **Status:** offen.

### SP-2.5 Installierbar und Historie nachladen
- **Umfang:** PWA mit Scan-Aktion; Nachladen der Historie nach einem Opt-in, gedrosselt, nach einer Vorschau und nur, wenn gerade niemand schießt; ältere Scheiben ohne SportpassID über Namensvorschläge (SF-36, SF-52). **Hängt ab von:** SP-1.7. **Status:** Nachladen erledigt: Jede bestätigte Zustimmung ist ein Auftrag in `GET /state`, die Brücke liest die passenden Scheiben der ganzen Ablage nur im Leerlauf (höchstens 50 je Runde) und meldet ihn im Heartbeat erledigt; ohne Vorschau. Offen: PWA, Vorschau, Namensvorschläge.

### SP-2.6 Ergebnisse von fremden Anlagen
- **Umfang:** vollständiger Parser in `packages/meyton-pdf`, konsolidiert aus Treffsicher ([[treffsicher-meyton-import]]) und Ringwerk ([[meyton-import]]) mit allen DoS-Grenzen und um Kopf und Fuß erweitert ([[meyton-printout]]); Meyton-QR ohne Brücke → Ergebnis ohne Rohdaten aus dem PDF als Versuch, sonst nur das PDF; später Trefferlage aus der PDF-Grafik zurückrechnen. Bestehende Import-Tests beider Apps bleiben grün; Sonderfälle SF-06, SF-44. **Hängt ab von:** SP-1.3, SP-1.7. **Status:** offen.

### SP-2.7 Erkenntnisse über Zeiträume
- **Umfang:** Profi-Analysen, die viele Scheiben brauchen ([[spiegel-statistics]]): Schussposition in der Serie (I7), Reaktion nach schwachem Schuss (I8), erster Wertungsschuss (I9), Tempo gegen Wert (Z6, Z7), Ausreißerrichtung (L7), Langzeit-Trefferbild, Form über mehrere Scheiben und Lage über Zeit (L9, L10), Bedeutsamkeit und Trendsteigung (T3, T4), Munitionslos und Ausrüstung, Tageszeit, Pause, Stand (K1–K5), Wettkampf gegen Training (W1–W4). Jede Aussage mit Mindestzahl, Unsicherheit und „unklar“, wenn die Daten nicht reichen. Die Karten Ermüdung, Pausen, Form und Richtungsuhr auf der Seite einer Scheibe bekommen dann einen Link auf diese Auswertung, wie heute σ auf Fortschritt. **Hängt ab von:** SP-2.1; SP-2.3 nur für Munitionslos und Ausrüstung (K1). **Status:** Konzept vom 21. Oktober 2026 ([[spiegel-langzeit]], „Analyse über den Zeitraum“): Überblick nur mit Belegtem, Reiter als Werkzeug, Trefferbild als zweites Hauptbild; W1–W4 auf der Seite „Vergleichen“ ([[spiegel-vergleichen]]), K6 im Tagebuch ([[adr-033]]). Drei Pläne: 1. Trefferbild und Lage (L9, L10, L7), in Arbeit; 2. Vergleichen (mit SP-2.2); 3. Überblick, Zeit und Ergebnis.

### SP-2.8 Training mit Messdaten
- **Umfang:** systematisch trainieren mit messbaren Übungen: „Bleib drüber“ (Schwelle halten), Zehntel-Ziel, längste Folge, Soll-Schnitt zum Ziel (W5), Zielwahrscheinlichkeit (W6), Erfolgsserien und Meilensteine (T8, R9), Auswertung je Übung über die Zeit. Ziele, Absicht und Reflexion liegen im Tagebuch von Spiegel, Spiegels Ergebnisteil liefert Messung und Kriterium ([[adr-033]]); damit ist auch geklärt, wo Messziele wie „R50 unter 1,5 mm“ liegen: im Tagebuch. **Hängt ab von:** SP-2.1, für Ziele das Tagebuch ([[adr-033]] Stufe 2). **Status:** offen.

## Phase 3 · Vernetzung

### SP-3.1 Treffsicher übernimmt aus Spiegel
- **Umfang:** Konto-Verknüpfung, API, „Aus Spiegel übernehmen“ statt PDF-Import, Trefferbild mit `shot-ui` in der Treffsicher-Einheit. **Status:** entfällt ([[adr-033]], 20. Oktober 2026): Das Tagebuch wird ein Teil von Spiegel, Treffsicher geht in den Ruhestand.

### SP-3.2 Trainer-Freigabe und Live
- **Umfang:** Freigaben je Schütze, Trainer-Ansicht, Live-Ansicht am Abend (Server-Sent Events, eventuell SDF). **Hängt ab von:** SP-1.8. **Status:** offen.

### SP-3.3 Ringwerk: Liga-Ergebnisse aus Spiegel
- **Umfang:** Serien und Teiler für Ringwerk-Wettbewerbe, nur Summen. **Hängt ab von:** SP-1.7. **Status:** offen.

## Phase 4 · Weichen stellen

### SP-4.1 Treffsicher ablösen oder behalten
- Entscheidung anhand echter Nutzung ([[adr-026]]). **Status:** entschieden am 20. Oktober 2026: [[adr-033]]. Eine App
  mit zwei streng getrennten Teilen: Spiegel hält jede Scheibe mit ihren Angaben und trägt allein die Statistik, das
  Tagebuch ist ein eigener Teil ohne Ergebnisse; ein Login; Treffsicher geht in den Ruhestand. Vier Stufen:
  vereinfachte Scheiben (mit dem QR-Weg zuerst), Tagebuch, verlustfreie Datenübernahme mit Prüfbestand, Ruhestand von
  Treffsicher. Beginn nach SP-4.3; Treffsicher bekommt bis dahin nur Fehlerbehebungen.

### SP-4.2 Gemeinsame Anmeldung
- Eine Anmeldung für alle Vereinsheim-Apps; eigene ADR. Nach [[adr-033]] betrifft das nur noch Ringwerk und Spiegel. **Status:** offen.

### SP-4.3 Design 2 für alle Apps
- Ringwerk und Treffsicher ziehen auf Design 2 um ([[adr-030]], [[adr-032]]). **Status:** umgesetzt im Oktober 2026:
  die gemeinsame Schicht in `@vereinsheim/ui/design2`, der Prüfbestand für Ringwerk ([[ringwerk-pruefbestand]]),
  Treffsicher samt Statistik ([[treffsicher-design2]]), Ringwerk mit Dialogen und Hilfe ([[ringwerk-design2]]) und das
  Drift-Gate über drei Apps mit den Regeln von Design 2 ([[drift-protection]], [[conventions]] §8). `theme.css` ist
  entfernt. Offen bleibt die Durchsicht nach drei Ebenen (unten unter „Offene Einzelpunkte“).

### SP-4.4 Weitere Quellen
- DISAG, neue Meyton-Linie ESTANX, Handeingabe als weitere Adapter ([[meyton-interfaces]]). Die Handeingabe (je Serie, je Schuss, mit Beleg) ist Teil von Stufe 1 aus [[adr-033]]. **Status:** offen.

## Offene Einzelpunkte

Was zwischen den Features offen ist und keinen eigenen Abschnitt hat.

- **Durchsicht von Treffsicher und Ringwerk nach drei Ebenen** (Rest von SP-4.3): **gemessen und zum Teil umgesetzt
  am 20. Oktober 2026** ([[treffsicher-durchsicht]], [[ringwerk-durchsicht]]; Werkzeug `pnpm --filter <app> durchsicht`).
  Umgesetzt: Dezimalkomma in Treffsicher, Sätze ohne Semikolon in `shot-ui`, Fehlerseiten, in Ringwerk die Tabelle vor
  dem Spielplan, der Einstieg nach Phase, der Turnierbaum ab der laufenden Runde und die Kürzel mit vollem Namen.
  Offen: die Befunde, die dort unter „Offen“ stehen.
- **PDFs in Design 2:** Die PDFs von Ringwerk und Treffsicher zeigen Ringwerte schon in den Farben von Spiegel
  (`SCORE_HEX`), Aufbau und Schrift sind noch die alten.
- **Liste als Filter im Fortschritt** und auf der Seite einer Scheibe eine Verknüpfung „alle Scheiben dieser Liste“.
- **Start des Laufs nach falscher Uhr** (SF-79): Startet die Brücke mit falscher Uhr, trägt `runStartedAt` den ganzen
  Lauf die falsche Zeit. Die Regel „ein neuer Lauf macht alles davor endgültig“ greift dann nicht, Scheiben von vor dem
  Neustart werden erst nach 12 h endgültig. Lösung: beim Wechsel auf eine stimmende Uhr den Start einmal aus der
  monotonen Zeit neu ansetzen, nie bei jedem Heartbeat; dafür braucht der Runner eine monotone Zeit, die Tests stellen
  können.
- **Zeitraum über Geräte hinweg merken:** bräuchte eine Spalte am Konto und eine Migration; heute merkt ihn das Gerät.
- **„Auf der Scheibe“ springt nicht:** gemeldet, aber ohne Gerät und Stelle; im Nachbau springt der Link überall.
  Nachfragen, wo es auftritt.
- **Liste und Fortschritt „Alles“** schicken rund 1 MB an den Browser ([[spiegel-db-schema]]); weniger ginge nur mit
  einer anderen Form der Daten.
- **Auf einem echten iPhone prüfen** (bisher nur Emulation in Chrome): VoiceOver, auch an den weichen Kreisen (sagt
  VoiceOver den Wechsel von Art und Wertung an?), sicherer Rand unten und im Querformat links und rechts (Notch),
  Ziehen am Diagramm-Lineal gegen senkrechtes Scrollen (`touch-action`, [[spiegel-mobile]]). Am Desktop ebenso nie
  selbst angesehen: Fokus-Reihenfolge mit echter Tastatur, Hover und Fokus von Navigation, Kacheln und Listenzeilen.
- **Leseprobe der Hilfe** (Abnahme von SP-1.11): Die Texte hat noch niemand ohne Statistik-Wissen gelesen. Dasselbe
  gilt für Dialoge, Profil, „Offen“ und Papierkorb: einmal von einem Mitglied ohne Vorwissen lesen lassen.
- **Über dem Verlauf des Fortschritts zwei Zeilen** unter 1440 px Breite: Kennzahl in der ersten, „je Scheibe/je
  Monat“ mit „?“ rechtsbündig in der zweiten; nichts angeschnitten. Die beiden Umschalter brauchen gut 520 px, die
  linke Spalte hat bei 1280 px rund 480. Offen, ob eine Zeile gewünscht ist (kürzere Namen oder schmalere Umschalter).
  Bei 768 × 660 stehen die Serien unter der Scheibe statt daneben; das ist gewollt, weil für die Scheibe sonst weniger
  als `MIN_TARGET_PX` (280) blieben.

### Admin und Bedienung

- **Disziplinen vorab und ohne Upload (Stufe 2 von Admin → Disziplinen):** Die Brücke meldet die Disziplinen der
  Anlage im Heartbeat (Nummer und Name, ohne Personen), damit ein Admin sie vor der ersten Scheibe einordnen kann, und
  schickt ignorierte gar nicht erst (Feld in `GET /state`). `heartbeatV1` ist ein `strictObject`: Spiegel zuerst
  deployen, dann die Brücke; Ergänzung zu [[adr-027]]. Danach ist Ignorieren ohne Nachladen nicht mehr umkehrbar.
  Braucht eine neue Brücke im Schützenhaus.
- **Scheiben ohne Scheibenbild zeigen:** Eine Disziplin mit „Eigene Scheibe“ (etwa Zimmerstutzen) fehlt in allen
  Übersichten, die Seite der Scheibe antwortet 404. Ein neutrales Raster (SF-17) brächte sie zurück.
- **Teiler als Wertung** der Vereinsspiele (Schach, Balken, Dart); heute ignoriert Spiegel sie.
- **Art je Disziplin** (etwa „LG Liga“ immer Wettkampf) als Vorgabe zwischen Liste und Quelle.
- **Auswertung der Ratenbegrenzung** hat keine Ansicht fürs Telefon (`@vereinsheim/ui/admin`).
- **Alte Wörter in Texten von Brücke und Einlesen:** `src/lib/ingest/http.ts` meldet „widerrufenes Gerät“ und
  „Kopplungscode“, die Hilfe der Brücke (`cmd/spiegel-bridge/main.go`) nennt „Kopplungscode aus Admin → Anlage und
  Brücken“. Die Oberfläche sagt „Anlage und Brücke“, „Brücke verbinden“, „Code für die Brücke“: erst ins Textbuch, dann
  angleichen.
- **Benachrichtigung des Admins außerhalb der App** (etwa Mail bei einer neuen Zustimmung): nie entschieden; heute steht
  sie nur in der Übersicht unter „Wartet auf dich“.
- **„Neue Rekorde“ auf Start** zählen auch die erste Scheibe einer Schusszahl, ohne früheren Halter. An echten Abenden
  prüfen, ob nur Rekorde erscheinen sollen, die einen früheren ablösen.

### Fachkern und Darstellung

- **Nur-Probe-Scheibe kann Wettkampf werden:** `kindOfRow` übergeht bei „nur Probe“ nur die Liste, nicht die Quelle; bei
  nicht leerem `Status` (andere Vereine) zeigt die Seite „Wettkampf“ ohne Schalter. Vorschlag: bei `probeOnly` immer
  Training, außer der Schütze hat gewählt ([[spiegel-navigation]], „Art der Scheibe“).
- **Projektion und Nachrechnen:** Ändert eine neue `PROJECTION_VERSION` die Form von `values` oder `records`, lesen die
  Übersichten bis zum Ende von `refreshStaleProjections` die alte Form. Regel festlegen: Formänderungen nur additiv oder
  mit Lesefallback ([[adr-031]]).
- **C4 und „gegen den Schnitt“:** Das Hilfe-Thema `gegen-den-schnitt` (Katalog C4) beschreibt den Abstand zu den fünf
  Scheiben davor; C4 und `againstOwnAverage` rechnen „30 Tage davor“ und „Perzentil unter den letzten 50“, die Funktion
  hat außer Katalog und Tests keinen Aufrufer, Regel 6 in [[spiegel-statistics]] zitiert sie. Entscheiden: eigene ID für
  den Abstand zu den fünf davor, oder C4, `againstOwnAverage` und Regel 6 streichen.
- **„Stufe 3“ der Durchsicht** (auf einer einzelnen Scheibe ausblenden, was dort nur Zufall zeigt) gehört zu SP-1.8;
  teilweise erledigt (Probe-Auswertung entfernt, Hinweise an großen Zahlen). Schließen oder als Rest übernehmen.

### Daten und Datenschutz

- **`consentVersion @default("v1")`** steht noch im Schema, aktuell ist v2; `tools/bridge-e2e.ts` und
  `tools/ingest-load.ts` legen Zustimmungen ohne Version an. Mit einer angehängten Migration den Standardwert entfernen,
  die Tools setzen `CURRENT_CONSENT_VERSION`. Dabei das tote Feld `ConsentRow.siteName` samt Join entfernen.
- **Neue Version des Hinweistexts:** Für eine künftige v3 gibt es keine Regel, wann eine erneute Zustimmung nötig ist
  und was bis dahin gilt ([[spiegel-privacy]]).
- **Export (JSON/CSV) und Konto löschen** sind nicht gebaut; ein Admin kann ein Konto nur deaktivieren
  ([[spiegel-privacy]]).

### Prüfung im Browser

- **Skriptprüfung:** „Stufe 2 der Inventur“ aus dem Labor fehlt in `pnpm --filter spiegel pruefen` (Antippen auf der
  Scheibe über `getScreenCTM`, 16-px-Abstände in allen Reitern, Kacheln ohne Anschnitt, Wertung per Kreis über alle
  Bausteine). Die Dialoge des Schützen („Nicht meine“, „Zustimmung widerrufen“, abgelehnte Nummer entfernen) öffnet sie
  nie. Für Zustände, die die Demo-Daten nicht haben (Mischabend, Scheibe nur aus dem PDF, drei Beobachtungen im Kopf am
  Telefon), erfundene Scheiben in `demoCardSeeds` ergänzen.

### Für den QR-Weg (SP-1.7 b)

- Eine als „nicht meine“ zurückgewiesene Scheibe ohne Sportpassnummer kann kein Admin wieder zulassen, die Zahl in der
  Übersicht zählt sie aber mit.
- Caddy nimmt höchstens 5 MiB je Anfrage an; mit Upload-Wegen des QR-Wegs (Teilen auf Android) die Grenze neu prüfen.
