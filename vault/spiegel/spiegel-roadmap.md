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
- **Hängt ab von:** nichts. **Status:** Werkzeug bereit (`tools/ssmdb2-erkunden`, [[ssmdb2-erkundung]], Oktober 2026), der Abend steht aus.

### SP-0.2 QR-ID prüfen
- **Ziel:** bestätigen, dass die ID im Fuß des Ausdrucks die ScheibenID ist (den QR gibt es laut Verein immer).
- **Umfang:** Abfrage aus [[meyton-printout]] mit `ff914420` → −7257056; dazu eine Scheibe ohne Starter schießen, ihren QR scannen und die ID nachschlagen. Prüfen, ob Meyton kleine IDs mit führenden Nullen auf acht Zeichen füllt (alle drei bekannten liegen über 0x10000000; sonst wären sie für das Muster unsichtbar).
- **Abnahme:** [[adr-028]] bestätigt oder angepasst.
- **Hängt ab von:** SP-0.1 (gleicher Abend). **Status:** offen.

### SP-0.3 Messlatte DISAG M-Qnect (optional)
- **Ziel:** sehen, was die ShotsApp mit unserer Anlage kann.
- **Umfang:** M-Qnect auf einem Android-Tablet im Meyton-Netz testen ([[meyton-interfaces]]).
- **Abnahme:** kurze Notiz in [[spiegel-vision]], was Spiegel besser machen muss. **Status:** offen.

### SP-0.4 Technik der Brücke entscheiden
- **Ziel:** Sprache und Auslieferung festlegen.
- **Umfang:** Go-Binary gegen Bun- oder Deno-Binary gegen Docker mit Node; Kriterien: eine Datei ohne Laufzeit, Raspberry Pi und Windows, Stromverlust, Selbst-Update, geteilter Vertrag. Empfehlung: Go mit „dummer“ Brücke ([[spiegel-bridge]]). Dazu der Ort: eigenes Gerät (ADR-027) oder, als Wunsch des Users, direkt auf dem Meyton-Rechner unter SUSE Linux ([[spiegel-open-questions]]).
- **Abnahme:** Ergänzung in [[adr-027]]. **Status:** offen.

### SP-0.5 Einwilligung und Datenschutz
- **Ziel:** rechtlich sauberer Start.
- **Umfang:** Einwilligungstext (Opt-in per Sportpass), Verantwortlicher, Auftragsverarbeitung mit dem Hoster; vorerst nur erwachsene Mitglieder, keine Gäste ([[spiegel-privacy]]).
- **Abnahme:** Text vom Vorstand abgestimmt. **Status:** offen.

### SP-0.6 Schießprotokoll mit Mitschnitt
- **Ziel:** sehen, wie sich die Ablage bei den Sonderfällen wirklich verhält, und Testdaten ableiten, die der Anlage gleichen.
- **Umfang:** Ein kleines Skript liest wie die Brücke, nur lesend, und schreibt jeden Zustand mit Zeit in ein Protokoll; Namen und SportpassIDs ersetzt es schon beim Mitschreiben. Dazu schießen wir mit der Standaufsicht das Schießprotokoll aus [[meyton-ssmdb2]] (Probe → Wertung → Probe, lange Probe, nur Probe, Abbruch, ohne Starter, Zwischen- und Doppelausdruck, Korrektur, falsche Disziplin, verdeckte Wertung) und sichern `SHOW CREATE TABLE` aller Tabellen. Ins Repo kommt nur das Schema; das Protokoll bleibt lokal und dient als Vorbild für synthetische Daten ([[adr-029]]).
- **Abnahme:** jeder Versuch mit Ergebnis in [[meyton-ssmdb2]] und [[spiegel-edge-cases]] eingetragen; Schema im Repo; Protokoll ohne Namen und Nummern.
- **Hängt ab von:** SP-0.1 (gleicher Abend). **Status:** Werkzeug bereit ([[ssmdb2-erkundung]]): Das Rohprotokoll mit Namen bleibt in `privat/`, der Bericht trägt Pseudonyme; der Abend steht aus.

## Phase 1 · Fundament

Ziel: **Mit Opt-in erscheint die Dienstagsscheibe von selbst in Spiegel; ohne Opt-in reicht der Meyton-QR.** Beide Male mit allen Schüssen, die Probe eingeschlossen, sofern die Brücke beim Schießen lief (SF-03).

**Meilenstein Durchstich:** Bevor Zuordnung und Oberfläche entstehen, läuft eine echte Scheibe einmal durch: SP-1.0a, SP-1.4a/b und SP-1.6a/b in der einfachsten Form, mit festem Filter auf die eigene SportpassID. Am Trainingsabend erscheint die Scheibe samt Probe roh in Spiegel. Gemessen werden Latenz, Abfragekosten auf der Anlage, Speicher je Scheibe und der Speicher des leeren Skeletts unter der 256-MB-Grenze, an der [[adr-026]] hängt. Was dabei überrascht, ändert den Plan, solange er noch billig zu ändern ist.

### SP-1.0 Vertrag und Sonderfall-Testdaten
- **Ziel:** Brücke und Spiegel haben einen festen Vertrag, und jeder Sonderfall ist für beide reproduzierbar.
- **Umfang:** `packages/ingest-contract` mit JSON-Schema, kanonischer Serialisierung und Testvektoren für die Prüfsumme sowie Beispiel-Snapshots; dazu MySQL im Docker mit dem Schema aus SP-0.6 (bis dahin nach Handbuch) und ein Generator, der je SF-ID Zeilen erzeugt, auch als Abfolge von Zuständen (Probe verschwindet, Korrektur, Reset). Dieselben Fälle dienen als Snapshots für Ingest-Tests und als kanonische Scheiben für die Oberfläche ([[spiegel-edge-cases]]). Nur synthetische Daten.
- **Schnitt:** a) Vertrag mit Testvektoren; b) Generator und MySQL-Fälle.
- **Abnahme:** Brücke und Spiegel rechnen dieselben Prüfsummen; jede SF-ID mit Datenbezug hat einen Fall; Sonderfälle SF-27, SF-69.
- **Hängt ab von:** nichts (Schema aus SP-0.6 später nachziehen). **Status:** in Arbeit. a) erledigt (Oktober 2026, `packages/ingest-contract`, [[spiegel-ingest-contract]]): Snapshot v1 mit Zellwerten als Text, Prüfsumme nach RFC 8785 mit sortierten Zeilen, Testvektoren aus einer unabhängigen Python-Implementierung, Fehler ohne Inhalt (SF-59 für den Vertrag), eingefrorene Beispiele. b) offen.

### SP-1.1 Fachkern: Scheibenbilder und Wertung
- **Ziel:** Scheiben korrekt zeichnen und werten.
- **Umfang:** `packages/shot-core`: Datenformat Scheibenbild; Bibliothek für eure 10-m-Stände, also Luftgewehr und Luftpistole (Auflage nutzt dieselben Scheiben), weitere Scheiben erst bei Bedarf; Regelkatalog DisziplinID → Regel (DSB und Meyton-eigen) → Scheibenbild, über Regelnummer und Schusscode mit Rückfall auf LG/LP als Wort im Namen, sonst Vorschlag per Gegenprobe mit Admin-Bestätigung; Disziplin-Familien; Neu-Wertung mit anderem Scheibenbild; Wertungsformel mit Innenzehner ([[spiegel-target-library]]).
- **Abnahme:** Gegenprobe reproduziert alle bekannten Meyton-Werte; Mutationsprobe nach [[conventions]] §9; Sonderfälle SF-09, SF-14, SF-16, SF-17, SF-18, SF-70.
- **Hängt ab von:** nichts. **Status:** erledigt (Oktober 2026, `packages/shot-core`).

### SP-1.2 Fachkern: Geometrie und Kennzahlen-Registry
- **Ziel:** die Rechenbasis für alle Auswertungen.
- **Umfang:** Schwerpunkt, kleinster Kreis, mittlerer Radius, Streuung, Intervalle; `defineMetric` mit Version und Ebenen; die ersten rund zehn Kennzahlen ([[spiegel-metrics]]).
- **Abnahme:** Eigenschafts- und Mutationstests; isomorph (Server und Client); Sonderfälle SF-01, SF-14, SF-60, SF-61, SF-62, SF-63.
- **Hängt ab von:** SP-1.1. **Status:** erledigt (Oktober 2026, `packages/shot-core`: `geometry`, `time`, `metrics`).

### SP-1.3 Meyton-PDF: ID und Druckzeit
- **Ziel:** QR-Zuordnung ohne Abhängigkeit vom Layout des Ausdrucks ([[adr-028]], Änderung vom 6. Oktober 2026).
- **Umfang:** `packages/meyton-pdf`, zunächst klein: aus einem PDF (Bytes) die ID im Fuß (`ID:` und acht Hex-Zeichen, auf allen Seiten, dekodiert als vorzeichenbehaftete 32-Bit-Zahl) und die Erstellzeit aus den Metadaten (mit Zeitzone) lesen; DoS-Grenzen für Größe und Seiten. Test-PDFs synthetisch, ohne Namen, auch mit abgewandeltem Layout.
- **Abnahme:** ID und Erstellzeit aus dem Beispiel-Format und aus abgewandelten PDFs (anderes Layout, mehrseitig, Probe-Ausdruck) gelesen; ohne ID oder Metadaten ein sauberes „nicht gefunden“; Sonderfälle SF-44, SF-46, SF-48.
- **Hängt ab von:** nichts. **Status:** erledigt (Oktober 2026, `packages/meyton-pdf`); die Grenzen greifen nur zwischen den Schritten von pdf.js, den Schutz gegen präparierte PDFs bringt der Kindprozess in SP-1.7.

### SP-1.4 Brücke v1: lesen, puffern, hochladen
- **Ziel:** Rohdaten kommen verlässlich aus dem Schützenhaus.
- **Umfang:** `apps/spiegel-bridge` nach [[spiegel-bridge]], ohne eigenen Zustand ([[adr-027]], Änderung vom 8. Oktober 2026): Kopplung, Leser mit Read-only-Transaktionen, Änderungserkennung, Snapshots mit Prüfsumme, Upload mit Wiederholung statt Warteschlange, Heartbeat, Statusseite; Probe höchstens im Arbeitsspeicher (nach SP-0.6); Betrieb mit Abschalten nach dem Training (Nachholen beim Start ab dem Wasserstand in Spiegel).
- **Schnitt:** a) Leser, Änderungserkennung und Snapshots, nur lokal; b) Kopplung, Upload und Heartbeat; c) Nachholen beim Start, Updates, Statusseite.
- **Abnahme:** gegen eine lokale MySQL mit SSMDB2-Schema und den Fällen aus SP-1.0, Ausfalltests (Netz weg, DB weg, Stecker ziehen während des Uploads; danach nichts auf der Platte außer der Konfiguration), einmal an der echten Anlage; Sonderfälle SF-02, SF-03, SF-07, SF-08, SF-10, SF-23, SF-24, SF-25, SF-26, SF-31, SF-32, SF-33, SF-49, SF-50, SF-51, SF-52, SF-53, SF-54, SF-55, SF-57, SF-58.
- **Hängt ab von:** SP-0.4, SP-1.0. **Status:** offen.

### SP-1.5 Brücke v1: Opt-in, Aufträge, verdeckte Wertung
- **Ziel:** nur das Richtige verlässt das Schützenhaus.
- **Umfang:** Liste gehashter SportpassIDs mit Opt-in, Live-Upload passender Scheiben samt Probe; Aufträge per Abfrage (Vorschau und Scheibe per ID, Fundbüro-Liste, Nachladen); Grabsteine; Modus 5 und 10 nie, Modus 0 erst nach Freigabe je Disziplin.
- **Abnahme:** Tests zu Filter, Verdeckung und Aufträgen; keine Scheibe ohne Opt-in oder Auftrag verlässt das Gerät; Sonderfälle SF-13, SF-19, SF-20, SF-28, SF-38, SF-41, SF-59.
- **Hängt ab von:** SP-1.4. **Status:** offen.

### SP-1.6 Spiegel-App: Skelett, Ingest-API, Normalisierung
- **Ziel:** Spiegel nimmt Daten an und versteht sie.
- **Umfang:** `apps/spiegel` nach Vereinsheim-Muster (Auth, Admin, Rate-Limit), Design-2-Tokens, Datenmodell ([[spiegel-data-model]]), Ingest-API mit Geräte-Token und Vertrag in `packages/ingest-contract`, Rohdaten-Store, Adapter `meyton-ssmdb2@9` mit Skalen, Zeitzone, Epochen, Revisionen ([[spiegel-ingest-pipeline]]).
- **Schnitt:** a) App-Skelett, Datenmodell und Design-2-Tokens, Speicher des leeren Skeletts lokal unter `mem_limit` 256 MB gemessen; b) Ingest-API, Rohdaten-Store als Zeilenversionen und Adapter.
- **Abnahme:** Snapshot rein → kanonische Scheibe raus, auch bei Korrektur und Epochenwechsel; `/check` grün; Sonderfälle SF-01, SF-02, SF-03, SF-04, SF-07, SF-08, SF-09, SF-15, SF-21, SF-22, SF-23, SF-25, SF-26, SF-28, SF-29, SF-30, SF-31, SF-59, SF-67, SF-69.
- **Hängt ab von:** SP-1.0, SP-1.1. **Status:** offen.

### SP-1.7 Zuordnung: Opt-in per Sportpass, Meyton-QR, Admin
- **Ziel:** jede Scheibe findet ihren Besitzer ([[spiegel-assignment]]).
- **Umfang:** Profil mit Sportpass-Opt-in, Admin-Bestätigung und Bestätigung der ersten Scheibe (die SportpassID pflegt der Admin bei Interessierten vorher in der Meyton-Schützenverwaltung nach); QR erfassen (Kamera im Browser, Link, „Teilen“ auf Android); PDF von erlaubten Adressen laden und als Original speichern; ID und Druckzeit lesen (SP-1.3); Auftrag an die Brücke, auch zurückgestellt, wenn sie aus ist; Vorschau mit Druckzeit-Plausibilität und Bestätigung; Auswahl nach Druckzeit ohne ID; PDF an vorhandene Scheiben hängen; Admin-Zuweisung; „Nicht meine“; Protokoll.
- **Schnitt:** a) Opt-in mit erster Bestätigung; b) QR-Weg mit PDF, Auftrag, Vorschau und Bestätigung; c) Admin-Zuweisung, „Nicht meine“, Teilen und Protokoll.
- **Abnahme:** Opt-in-Scheibe erscheint ohne Zutun; QR-Weg mit einem anonymisierten Ausdruck lokal und an der Anlage; QR-Scan bei ausgeschalteter Brücke ergibt ein PDF-Ergebnis, das beim nächsten Start vollständig wird; PDFs liest der Server nur in einem kurzlebigen Kindprozess mit Speichergrenze und hartem Abbruch, die präparierten PDFs aus dem SP-1.3-Review bringen ihn nicht zu Fall; Sonderfälle SF-12, SF-28, SF-34, SF-35, SF-37, SF-38, SF-39, SF-40, SF-41, SF-42, SF-43, SF-45, SF-47, SF-48, SF-56.
- **Hängt ab von:** SP-1.3, SP-1.5, SP-1.6. **Status:** offen.

### SP-1.8 Scheiben-Liste und Session-Detail
- **Ziel:** das, was der Prototyp verspricht.
- **Umfang:** Liste nach Trainingsabend; Session-Detail mit Trefferbild (Overlays, Zoom), Serien und Probe-Blöcken als kleine Scheiben, Schusstabelle, Wiedergabe, Kennzahl-Kacheln, Bereich „Analyse“ mit den Auswertungen aus SP-1.10, Beobachtung, Original-PDF, Merkmalen und Aktionen an der Scheibe ([[spiegel-ui-design]]); Umschalter ganze Ringe/Zehntel überall; Zeichenregeln aus „Zeichnen der Scheibe“; `packages/shot-ui`.
- **Abnahme:** Sichtprüfung gegen das Labor (`tools/labor`) und die Spielwiese, für Bildschirme ohne Vorbild dort gegen `vault/_attachments/spiegel-konzept.html`, auf Handy und Desktop, dunkel und, falls der Hellmodus in Phase 1 kommt, hell ([[spiegel-open-questions]]); Markup-Tests; Skriptprüfung des Labors grün; Sonderfälle SF-01, SF-02, SF-05, SF-07, SF-11, SF-16, SF-18, SF-61.
- **Hängt ab von:** SP-1.2, SP-1.6, SP-1.11 (Hilfe an jeder Zahl). **Status:** in Arbeit (Oktober 2026): Die Bausteine entstehen schon jetzt in `packages/shot-ui` und werden im Labor erprobt, ein Plan je Schritt. Schritt 1 (Design-2-Tokens, Scheibe mit Nummern in Ebenen und Auswahl, Serien als Schalter, Zustand, Labor), Schritt 2 (Kacheln, Ablesung und Übersicht, Schusstabelle mit Trennern je Serie, Wertung, Hilfe mit Blatt, Tippen auf den nächsten Schuss) und Schritt 3 (Analyse in sechs Reitern mit Karten und Diagrammen, über die Wertung ohne Probe, [[spiegel-ui-design]]) sind erledigt; „Visier verstellt“ ist auf Wunsch des Users gestrichen. Schritt 4 (Seitenaufbau für Telefon, Tablet und Desktop: Kopf mit Ergebnis, Sprungleiste, Scheibe fest ab 768 px, Hilfe als Blatt, Rücksprung zur Scheibe, Anker in der Adresse; [[spiegel-mobile]]) ist erledigt; Schritt 5 (Diagramm-Lineal: Werte per Antippen, „Werte als Tabelle“, „Auf der Scheibe“; [[spiegel-mobile]]) ist erledigt; es folgen Zoom, Wiedergabe und Vergleiche. Navigation, Einstieg und Scheiben-Liste sind entschieden ([[spiegel-navigation]], 9. Oktober 2026) und kommen als Schritte N1 (Routen-Modell, erledigt 9. Oktober 2026: `shot-ui/nav`), N2 (Abende und Liste), N3 (App-Rahmen), N4 (Auswahl), N5 (Start im Labor); N6 und N7 hängen an SP-1.7 und SP-1.6. Die App-Seiten mit echten Daten kommen nach SP-1.6.

### SP-1.9 Betrieb: Deploy und Selbst-Hosting
- **Ziel:** Spiegel läuft auf dem VPS und ist für andere Vereine betreibbar.
- **Umfang:** dritte DB und Owner mit idempotentem Anlage-Schritt, `app-spiegel` und `migrate-spiegel` in `compose.yml`, Caddy-Subdomain und Ingest-Endpunkt, Backups inklusive PDF-Speicher, CLI; ohne VPS-Upgrade: `mem_limit` für Spiegel (Ziel 256 MB), Deploys nacheinander, Messung von Ruhe- und Deploy-Spitze auf dem VPS S mit 2 GB ([[adr-026]]); Compose-Beispiel und Doku für Selbst-Hoster ([[adr-029]]).
- **Abnahme:** Deploy auf dem VPS, Speicher bleibt in Ruhe und beim Deploy unter der Grenze, Restore-Probe, Selbst-Hosting-Beispiel startet lokal; Sonderfälle SF-67, SF-68.
- **Hängt ab von:** SP-1.6. Geschützte Pfade, interaktiv. **Status:** offen.

### SP-1.10 Fachkern: Analyse einer Scheibe
- **Ziel:** alles, was eine einzelne Scheibe hergibt, als Profi-Analyse rechnen, ohne Datenbank und ohne Historie ([[spiegel-statistics]]).
- **Umfang:** `shot-core` bekommt Statistik-Hilfen (`stats`: Quantile, MAD, Wilson, χ²- und F-Quantile, c4, Theil-Sen) und das Modul `analysis`: Ergebnis (Ringverteilung, Zehntelverteilung, bester und schwächster Schuss, Teiler-Schnitt und -Listen, Ringverlust, Konstanz, Quoten), Präzision (Rayleigh-σ mit Vertrauensbereich, Höhe und Breite, Form, Ringbreiten, Ausreißer), Lage (Hotelling-Test „ist die Lage echt?“, Ringverlust durch Lage gegen Streuung, Lageanteil, Richtungsuhr, Drift), Zeit (Tempo-Konstanz, Netto-Schießzeit, Wiedereinstieg nach Pausen, Rhythmus-Profil), Verlauf (Serienkurve, Ermüdung, Trend in der Scheibe, gleitender Schnitt, Streuung und Schwerpunkt je Serie, längste Folge), Probe (Umfang, Qualität, „eingeschossen?“) und Datenlage; neue Kennzahlen in der Registry (σ̂, Höhe, Breite, Zehnerquote, Tempo-Streuung, Dauer).
- **Abnahme:** feste Erwartungswerte aus Tabellen und Hand-Rechnung, Mutationsprobe nach [[conventions]] §9; Spielwiese mit Beispielscheiben zeigt alles; Sonderfälle SF-01, SF-14, SF-15, SF-30, SF-60, SF-61, SF-63.
- **Hängt ab von:** SP-1.2. **Status:** erledigt (Oktober 2026, `packages/shot-core`: `stats`, `analysis`, sechs neue Kennzahlen; Spielwiese mit Bereich „Analyse“). Nach dem Review: Ausreißer per F-Test gegen die übrigen mit Bonferroni, Form per Mauchly, alle Nummern über `shotNumbers`, jede wertbasierte Auswertung in beiden Wertungen.

### SP-1.11 Hilfe und Erklärungen
- **Ziel:** Jede Zahl in Spiegel ist erklärt, für Einsteiger wie für Profis. Wunsch des Users: „ich verstehe nicht alle … gute Dokumentation und Hilfe, auch in der Anwendung, das ist wichtig“.
- **Umfang:** Erklärtexte als Daten aus **einer** Quelle für App und Doku, neben Kennzahlen und Auswertungen (entschieden: eigenes Paket `packages/shot-help`): je Eintrag ein Satz für die Kachel, die Erklärung „Was / So liest du es / Was du tun kannst / Vorsicht“ und auf Wunsch die Formel. Dazu Glossar, Einstieg „So liest du die Analyse“ (n, 95-%-Bereich, echt/unklar, ganze Ringe/Zehntel) und typische Fehlschlüsse. In der Oberfläche ein „?“ an jeder Kachel und Karte, Erklärung auch bei „–“ (Mindestzahl) und „unklar“ ([[spiegel-ui-design]]). Die Texte stehen in `@vereinsheim/shot-help`; [[spiegel-statistics-help]] wird daraus erzeugt, die Spielwiese zeigt sie hinter „Was heißt das?“.
- **Abnahme:** Ein Test erzwingt für jede Kennzahl der Registry und jede Auswertung einen Hilfetext (wie der Paar-Test der Wertungen); Sichtprüfung auf Handy und Desktop; Leseprobe mit dem User, der die Statistik nicht im Detail kennt.
- **Hängt ab von:** SP-1.10. **Status:** erledigt (Oktober 2026, `packages/shot-help`: 25 Themen, nach SP-1.12 24, Einstieg, Glossar, typische Fehlschlüsse; Tests gegen `METRICS` und das neue `ANALYSIS_CATALOG` aus `shot-core`; der Vault-Leitfaden ist daraus erzeugt, ein Test hält beide gleich). Das „?“ in der App kommt mit SP-1.8, bis dahin zeigt die Spielwiese die Texte.

### SP-1.12 Statistik straffen und Erklärungen berichtigen
- **Ziel:** Jede Zahl in Spiegel beantwortet eine eigene Frage, und jede Erklärung stimmt. Wunsch des Users: „den Nutzen der Statistiken genau überprüfen und Redundantes entfernen, und noch wichtiger, die Korrektheit der Erklärungen und Hilfen überprüfen“.
- **Umfang:** Drei unabhängige Prüfungen (Hilfe gegen Code, Zahlen per Simulation, Nutzen und Redundanz); entfernt nach Stufe 1 + 2 (E6, E7, P3, P7, L5, Netto-Zeit und Schüsse je Stunde, längste Pause, Sprünge in L8, Verhältnis Ø Abstand/R50; E9 in L4, S1 in S4, V7 neu als Kosten der markierten Ausreißer, P9 als R50/W); Code-Fehler behoben (Trend nach Mann-Kendall mit Bindungen, Lage-Verlust per Leave-one-out); alle Texte berichtigt, Trefferbild und Vertrauensellipse erklärt; Belege per `pnpm --filter @vereinsheim/shot-help simulate` ([[spiegel-statistics]], „Belege aus Simulationen“). Plan: `plans/2026-10-07-spiegel-straffen.md`.
- **Abnahme:** Tests gegen entfernte IDs (Rückwärtstest), Mutationsproben, Skriptprüfung der Spielwiese, Leseprobe mit dem User.
- **Hängt ab von:** SP-1.11. **Status:** erledigt (Oktober 2026). Stufe 3 (auf der Scheibe ausblenden, was dort nur Zufall zeigt) gehört zur Gestaltung in SP-1.8.

## Phase 2 · Auswertung

### SP-2.1 Verläufe und Rekorde
- **Umfang:** Verlauf jeder Kennzahl je Disziplin-Familie mit Filtern und gleitendem Schnitt, Rekorde je Wertung (ganze Ringe, Zehntel), Kalender ([[spiegel-metrics]]); aus dem Katalog ([[spiegel-statistics]]) T1, T2, T5–T7, R1–R8, V3–V5; für Verläufe über unterschiedliche Schusszahlen σ̂ statt Streukreis; Sonderfälle SF-60, SF-64, SF-65, SF-66. Seite und Bedienung: [[spiegel-langzeit]] (Entwurf, Oktober 2026). **Hängt ab von:** SP-1.2, SP-1.8, SP-1.10. **Status:** Fachkern erledigt (L2, 8. Oktober 2026: T1, T2, T5, T6, R1–R8 in `shot-core/analysis`), Oberfläche im Labor (L3, 9. Oktober 2026: Seite eines Zeitraums in `shot-ui/period`); T7 (Kalender) und V3–V5 offen.

### SP-2.2 Direkte Vergleiche und Beobachtungen
- **Umfang:** Serie, Scheibe, Zeitraum, Merkmal, Baseline; Sätze aus Kennzahlen nach den Regeln für ehrliche Zahlen; aus dem Katalog C1–C6 (C5 und C6 nach SP-2.3) und die Beobachtungen in Worten ([[spiegel-statistics]]). **Hängt ab von:** SP-2.1. **Status:** Fachkern für C3, C4 und T3 erledigt (L2, 8. Oktober 2026), Oberfläche im Labor (L3, 9. Oktober 2026: Vergleich zweier Zeiträume in der Seite eines Zeitraums); der Rest offen.

### SP-2.3 Notizen, Tags, Ausrüstung
- **Umfang:** Kontext an Scheibe und Serie, Grundlage für Vergleiche nach Merkmal (Munitionslos, Griff). Ein Ereignis „Visier verstellt“ gibt es nicht (User, 8. Oktober 2026, [[spiegel-open-questions]]); S1, S3 und S4 nehmen die letzten fünf Probeschüsse. **Hängt ab von:** SP-1.8. **Status:** offen.

### SP-2.4 Fundbüro und Check-in (bedingt)
- **Umfang:** „Scheibe holen“ am Abend als Rückfall für verlorene oder abgelaufene QR-Links, Frist sieben Tage, kein Tablet; optional Check-in per Stand-Aufkleber. Weil es den QR immer gibt, wahrscheinlich nur in kleinem Umfang nötig ([[spiegel-assignment]]). **Hängt ab von:** SP-1.7. **Status:** offen.

### SP-2.5 Installierbar und Historie nachladen
- **Umfang:** PWA mit Scan-Aktion; Nachladen der Historie nach einem Opt-in, gedrosselt, nach einer Vorschau und nur, wenn gerade niemand schießt; ältere Scheiben ohne SportpassID über Namensvorschläge (SF-36, SF-52). **Hängt ab von:** SP-1.7. **Status:** offen.

### SP-2.6 Ergebnisse von fremden Anlagen
- **Umfang:** vollständiger Parser in `packages/meyton-pdf`, konsolidiert aus Treffsicher ([[treffsicher-meyton-import]]) und Ringwerk ([[meyton-import]]) mit allen DoS-Grenzen und um Kopf und Fuß erweitert ([[meyton-printout]]); Meyton-QR ohne Brücke → Ergebnis ohne Rohdaten aus dem PDF als Versuch, sonst nur das PDF; später Trefferlage aus der PDF-Grafik zurückrechnen. Bestehende Import-Tests beider Apps bleiben grün; Sonderfälle SF-06, SF-44. **Hängt ab von:** SP-1.3, SP-1.7. **Status:** offen.

### SP-2.7 Erkenntnisse über Zeiträume
- **Umfang:** Profi-Analysen, die viele Scheiben brauchen ([[spiegel-statistics]]): Schussposition in der Serie (I7), Reaktion nach schwachem Schuss (I8), erster Wertungsschuss (I9), Tempo gegen Wert (Z6, Z7), Ausreißerrichtung (L7), Langzeit-Trefferbild, Form über mehrere Scheiben und Lage über Zeit (L9, L10), Bedeutsamkeit und Trendsteigung (T3, T4), Munitionslos und Ausrüstung, Tageszeit, Pause, Stand (K1–K5), Wettkampf gegen Training (W1–W4). Jede Aussage mit Mindestzahl, Unsicherheit und „unklar“, wenn die Daten nicht reichen. **Hängt ab von:** SP-2.1, SP-2.3. **Status:** offen.

### SP-2.8 Training mit Messdaten
- **Umfang:** systematisch trainieren mit messbaren Übungen: „Bleib drüber“ (Schwelle halten), Zehntel-Ziel, längste Folge, Soll-Schnitt zum Ziel (W5), Zielwahrscheinlichkeit (W6), Erfolgsserien und Meilensteine (T8, R9), Auswertung je Übung über die Zeit. Ziele, Absicht und Reflexion bleiben laut [[adr-026]] in Treffsicher; Spiegel liefert Messung und Kriterium (Verknüpfung über SP-3.1). **Offene Frage an den User:** W5 und W6 brauchen ein Ziel; ob Messziele wie „R50 unter 1,5 mm“ in Spiegel liegen dürfen, öffnet ADR-026 wieder. **Hängt ab von:** SP-2.1, für Ziele aus Treffsicher SP-3.1. **Status:** offen.

## Phase 3 · Vernetzung

### SP-3.1 Treffsicher übernimmt aus Spiegel
- **Umfang:** Konto-Verknüpfung, API, „Aus Spiegel übernehmen“ statt PDF-Import, Trefferbild mit `shot-ui` in der Treffsicher-Einheit. **Hängt ab von:** SP-1.8. **Status:** offen.

### SP-3.2 Trainer-Freigabe und Live
- **Umfang:** Freigaben je Schütze, Trainer-Ansicht, Live-Ansicht am Abend (Server-Sent Events, eventuell SDF). **Hängt ab von:** SP-1.8. **Status:** offen.

### SP-3.3 Ringwerk: Liga-Ergebnisse aus Spiegel
- **Umfang:** Serien und Teiler für Ringwerk-Wettbewerbe, nur Summen. **Hängt ab von:** SP-1.7. **Status:** offen.

## Phase 4 · Weichen stellen

### SP-4.1 Treffsicher ablösen oder behalten
- Entscheidung anhand echter Nutzung ([[adr-026]]). **Status:** offen.

### SP-4.2 Gemeinsame Anmeldung
- Eine Anmeldung für alle Vereinsheim-Apps; eigene ADR. **Status:** offen.

### SP-4.3 Design 2 für alle Apps
- Ringwerk und Treffsicher ziehen auf Design 2 um ([[adr-030]]). **Status:** offen.

### SP-4.4 Weitere Quellen
- DISAG, neue Meyton-Linie ESTANX, Handeingabe als weitere Adapter ([[meyton-interfaces]]). **Status:** offen.
