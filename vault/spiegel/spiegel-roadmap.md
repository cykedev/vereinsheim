---
id: spiegel-roadmap
type: guide
title: "Spiegel — Roadmap und Features"
aliases: [spiegel-backlog, spiegel-phasen, spiegel-fahrplan]
keywords: [roadmap, backlog, fahrplan, phasen, epics, features, sp-0, sp-1, sp-2, sp-3, sp-4, abnahme, abhängigkeiten, status, piv, plan, implement, sessions]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-open-questions]]"]
---

**TL;DR** Spiegel wird in fünf Phasen gebaut: Erkundung, Fundament, Auswertung, Vernetzung, Weichenstellung. Jedes Feature hat eine ID (SP-x.y), ein Ziel, einen Umfang, eine Abnahme, Abhängigkeiten und einen Status und ist so geschnitten, dass es in einer Session über `/plan → /implement → /validate → /review` umgesetzt werden kann.

# Spiegel — Roadmap und Features

## So nutzen wir diese Roadmap

- **Ein Feature pro Session** (große Features in mehrere Pläne geteilt). Vor dem Start prüfen, ob die Abhängigkeiten erledigt sind.
- `/plan` bekommt den Feature-Abschnitt als Auftrag; der Plan verweist zurück auf die Feature-ID.
- Nach dem Merge den **Status** hier nachziehen (offen → in Arbeit → erledigt) und Erkenntnisse in die Fach-Notes schreiben ([[spiegel]]).
- Features mit Deploy-Vertrag, Schema oder ADRs laufen interaktiv ([[autopilot-guard-blocks-contract-only-plans]]).
- **Früh startbar ohne Erkundung:** SP-1.1, SP-1.2 und SP-1.3 sind reine Paketarbeit und hängen nicht an der Anlage.

## Phase 0 · Erkundung

Ziel: Fakten über unsere Anlage, bevor wir Annahmen in Code gießen.

### SP-0.1 SSMDB2 vor Ort erkunden
- **Ziel:** wissen, was in unserer Ablage steht.
- **Umfang:** SQL-Checkliste aus [[meyton-ssmdb2]] an einem Trainingsabend; dazu zwei Handgriffe (einen Schuss bewusst hoch rechts setzen, Latenz bis zur neuen Zeile stoppen). Der SSMDB2-Dienst ist aktiv. Fragen: Landen Trainings ohne Starter in der Ablage (den QR gibt es immer, ohne Ablage gäbe es aber nur das PDF-Ergebnis)? Skalen der Ring-Felder? Achsenrichtung? Teiler-Einheiten? Wie weit reicht die Historie? Bleiben Probeschüsse nach der Wertung? Größte SportpassID (Überlauf)? Uhrabweichung? Liegen die PDF-Ausdrucke auch auf der Freigabe `ERGEBNIS`?
- **Abnahme:** Antworten (ohne Namen) in [[meyton-ssmdb2]] und [[spiegel-open-questions]] eingetragen.
- **Hängt ab von:** nichts. **Status:** offen.

### SP-0.2 QR-ID prüfen
- **Ziel:** bestätigen, dass die ID im Fuß des Ausdrucks die ScheibenID ist (den QR gibt es laut Verein immer).
- **Umfang:** Abfrage aus [[meyton-printout]] mit `ff914420` → −7257056; dazu eine Scheibe ohne Starter schießen, ihren QR scannen und die ID nachschlagen.
- **Abnahme:** [[adr-028]] bestätigt oder angepasst.
- **Hängt ab von:** SP-0.1 (gleicher Abend). **Status:** offen.

### SP-0.3 Messlatte DISAG M-Qnect (optional)
- **Ziel:** sehen, was die ShotsApp mit unserer Anlage kann.
- **Umfang:** M-Qnect auf einem Android-Tablet im Meyton-Netz testen ([[meyton-interfaces]]).
- **Abnahme:** kurze Notiz in [[spiegel-vision]], was Spiegel besser machen muss. **Status:** offen.

### SP-0.4 Technik der Brücke entscheiden
- **Ziel:** Sprache und Auslieferung festlegen.
- **Umfang:** Go-Binary gegen Bun- oder Deno-Binary gegen Docker mit Node; Kriterien: eine Datei ohne Laufzeit, Raspberry Pi und Windows, Stromverlust, Selbst-Update, geteilter Vertrag. Empfehlung: Go mit „dummer“ Brücke ([[spiegel-bridge]]).
- **Abnahme:** Ergänzung in [[adr-027]]. **Status:** offen.

### SP-0.5 Einwilligung und Datenschutz
- **Ziel:** rechtlich sauberer Start.
- **Umfang:** Einwilligungstext (Opt-in per Sportpass), Verantwortlicher, Auftragsverarbeitung mit dem Hoster; vorerst nur erwachsene Mitglieder, keine Gäste ([[spiegel-privacy]]).
- **Abnahme:** Text vom Vorstand abgestimmt. **Status:** offen.

## Phase 1 · Fundament

Ziel: **Mit Opt-in erscheint die Dienstagsscheibe von selbst in Spiegel; ohne Opt-in reicht der Meyton-QR.** Beide Male mit allen Schüssen.

### SP-1.1 Fachkern: Scheibenbilder und Wertung
- **Ziel:** Scheiben korrekt zeichnen und werten.
- **Umfang:** `packages/shot-core`: Datenformat Scheibenbild; Bibliothek für eure 10-m-Stände, also Luftgewehr und Luftpistole (Auflage nutzt dieselben Scheiben), weitere Scheiben erst bei Bedarf; Regelkatalog DisziplinID → Regel (DSB und Meyton-eigen) → Scheibenbild, mit Rückfall über Entfernung 10 m plus Namensanfang LG/LP und sonst Admin-Zuordnung; Wertungsformel mit Innenzehner ([[spiegel-target-library]]).
- **Abnahme:** Gegenprobe reproduziert alle bekannten Meyton-Werte; Mutationsprobe nach [[conventions]] §9.
- **Hängt ab von:** nichts. **Status:** offen.

### SP-1.2 Fachkern: Geometrie und Kennzahlen-Registry
- **Ziel:** die Rechenbasis für alle Auswertungen.
- **Umfang:** Schwerpunkt, kleinster Kreis, mittlerer Radius, Streuung, Intervalle; `defineMetric` mit Version und Ebenen; die ersten rund zehn Kennzahlen ([[spiegel-metrics]]).
- **Abnahme:** Eigenschafts- und Mutationstests; isomorph (Server und Client).
- **Hängt ab von:** SP-1.1. **Status:** offen.

### SP-1.3 Meyton-PDF-Paket
- **Ziel:** ein Parser für alle Apps.
- **Umfang:** `packages/meyton-pdf` aus dem Treffsicher-Parser ([[treffsicher-meyton-import]]) mit allen DoS-Grenzen; Ringwerk-Parser ([[meyton-import]]) konsolidieren; erweitern um Kopf und Fuß (Stand, StartNr, Zeiten, ID, #Nummer, Zähler, Teiler, Trefferkreis, Trefferlage) laut [[meyton-printout]]. Test-PDFs ohne echte Namen.
- **Abnahme:** alle bestehenden Import-Tests grün in beiden Apps; neue Felder getestet.
- **Hängt ab von:** nichts. **Status:** offen.

### SP-1.4 Brücke v1: lesen, puffern, hochladen
- **Ziel:** Rohdaten kommen verlässlich aus dem Schützenhaus.
- **Umfang:** `apps/spiegel-bridge` nach [[spiegel-bridge]]: Kopplung, Leser mit Read-only-Transaktionen, Änderungserkennung, Snapshots mit Prüfsumme, Warteschlange, Upload, Heartbeat, Statusseite; Betrieb mit Abschalten nach dem Training (Stromverlust, Nachholen beim Start).
- **Abnahme:** gegen eine lokale MySQL mit SSMDB2-Schema und Testdaten, Ausfalltests (Netz weg, DB weg, wiederholt Stecker ziehen während Upload und Schreiben), einmal an der echten Anlage.
- **Hängt ab von:** SP-0.4, Vertrag aus SP-1.6. **Status:** offen.

### SP-1.5 Brücke v1: Opt-in, Aufträge, verdeckte Wertung
- **Ziel:** nur das Richtige verlässt das Schützenhaus.
- **Umfang:** Liste gehashter SportpassIDs mit Opt-in, Live-Upload passender Scheiben samt Probe; Aufträge per Abfrage (Scheibe per ID, Fundbüro-Liste, Nachladen); Modus 5/10/unbekannt nie hochladen.
- **Abnahme:** Tests zu Filter, Verdeckung und Aufträgen; keine Scheibe ohne Opt-in oder Auftrag verlässt das Gerät.
- **Hängt ab von:** SP-1.4. **Status:** offen.

### SP-1.6 Spiegel-App: Skelett, Ingest-API, Normalisierung
- **Ziel:** Spiegel nimmt Daten an und versteht sie.
- **Umfang:** `apps/spiegel` nach Vereinsheim-Muster (Auth, Admin, Rate-Limit), Design-2-Tokens, Datenmodell ([[spiegel-data-model]]), Ingest-API mit Geräte-Token und Vertrag in `packages/ingest-contract`, Rohdaten-Store, Adapter `meyton-ssmdb2@9` mit Skalen, Zeitzone, Epochen, Revisionen ([[spiegel-ingest-pipeline]]).
- **Abnahme:** Snapshot rein → kanonische Scheibe raus, auch bei Korrektur und Epochenwechsel; `/check` grün.
- **Hängt ab von:** SP-1.1. **Status:** offen.

### SP-1.7 Zuordnung: Opt-in per Sportpass, Meyton-QR, Admin
- **Ziel:** jede Scheibe findet ihren Besitzer ([[spiegel-assignment]]).
- **Umfang:** Profil mit Sportpass-Opt-in und Admin-Bestätigung (die SportpassID pflegt der Admin bei Interessierten vorher in der Meyton-Schützenverwaltung nach); QR-Scan (Kamera) oder Link; PDF von erlaubten Adressen laden und speichern; ID dekodieren; Auftrag an die Brücke, auch zurückgestellt, wenn sie aus ist; Gegenprobe; Vorschau; PDF an vorhandene Scheiben hängen; Admin-Zuweisung; Protokoll.
- **Abnahme:** Opt-in-Scheibe erscheint ohne Zutun; QR-Weg mit einem anonymisierten Ausdruck lokal und an der Anlage; QR-Scan bei ausgeschalteter Brücke ergibt ein PDF-Ergebnis, das beim nächsten Start vollständig wird.
- **Hängt ab von:** SP-1.3, SP-1.5, SP-1.6. **Status:** offen.

### SP-1.8 Scheiben-Liste und Session-Detail
- **Ziel:** das, was der Prototyp verspricht.
- **Umfang:** Liste; Session-Detail mit Trefferbild (Overlays, Zoom), Serien als kleine Scheiben, Schusstabelle, Wiedergabe, Kennzahl-Kacheln, Beobachtung, Original-PDF ([[spiegel-ui-design]]); `packages/shot-ui`.
- **Abnahme:** Sichtprüfung gegen `vault/_attachments/spiegel-konzept.html` auf Handy und Desktop, hell und dunkel; Markup-Tests.
- **Hängt ab von:** SP-1.2, SP-1.6. **Status:** offen.

### SP-1.9 Betrieb: Deploy und Selbst-Hosting
- **Ziel:** Spiegel läuft auf dem VPS und ist für andere Vereine betreibbar.
- **Umfang:** dritte DB und Owner mit idempotentem Anlage-Schritt, `app-spiegel` und `migrate-spiegel` in `compose.yml`, Caddy-Subdomain und Ingest-Endpunkt, Backups inklusive PDF-Speicher, CLI; ohne VPS-Upgrade: `mem_limit` für Spiegel (Ziel 256 MB), Deploys nacheinander, Messung von Ruhe- und Deploy-Spitze auf dem VPS S mit 2 GB ([[adr-026]]); Compose-Beispiel und Doku für Selbst-Hoster ([[adr-029]]).
- **Abnahme:** Deploy auf dem VPS, Speicher bleibt in Ruhe und beim Deploy unter der Grenze, Restore-Probe, Selbst-Hosting-Beispiel startet lokal.
- **Hängt ab von:** SP-1.6. Geschützte Pfade, interaktiv. **Status:** offen.

## Phase 2 · Auswertung

### SP-2.1 Verläufe und Rekorde
- **Umfang:** Verlauf jeder Kennzahl mit Filtern und gleitendem Schnitt, Rekorde, Kalender ([[spiegel-metrics]]). **Hängt ab von:** SP-1.2, SP-1.8. **Status:** offen.

### SP-2.2 Direkte Vergleiche und Beobachtungen
- **Umfang:** Serie, Scheibe, Zeitraum, Merkmal, Baseline; Sätze aus Kennzahlen. **Hängt ab von:** SP-2.1. **Status:** offen.

### SP-2.3 Notizen, Tags, Ausrüstung
- **Umfang:** Kontext an Scheibe und Serie, Grundlage für Vergleiche nach Merkmal (Munitionslos, Griff). **Hängt ab von:** SP-1.8. **Status:** offen.

### SP-2.4 Fundbüro und Check-in (bedingt)
- **Umfang:** „Scheibe holen“ am Abend als Rückfall für verlorene oder abgelaufene QR-Links, Frist sieben Tage, kein Tablet; optional Check-in per Stand-Aufkleber. Weil es den QR immer gibt, wahrscheinlich nur in kleinem Umfang nötig ([[spiegel-assignment]]). **Hängt ab von:** SP-1.7. **Status:** offen.

### SP-2.5 Installierbar und Historie nachladen
- **Umfang:** PWA mit Scan-Aktion; Nachladen der Historie nach einem Opt-in, gedrosselt. **Hängt ab von:** SP-1.7. **Status:** offen.

### SP-2.6 Ergebnisse von fremden Anlagen
- **Umfang:** Meyton-QR ohne Brücke → Ergebnis ohne Rohdaten aus dem PDF, später Trefferlage aus der PDF-Grafik zurückrechnen. **Hängt ab von:** SP-1.3, SP-1.7. **Status:** offen.

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
