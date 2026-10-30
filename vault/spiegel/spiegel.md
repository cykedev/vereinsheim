---
id: spiegel
type: guide
title: "Spiegel — Schussrohdaten aus der Meyton-Anlage"
aliases: [Spiegel, spiegel-app, Schussdaten-App]
keywords: [spiegel, schussdaten, rohdaten, meyton, ssmdb2, trefferbild, schussbild, streukreis, schwerpunkt, dritte app, großvorhaben, plan, wegweiser, sonderfälle]
part_of: ["[[overview]]"]
governed_by: ["[[adr-026]]"]
---

**TL;DR** Spiegel ist die dritte Vereinsheim-App, seit 14. Oktober 2026 auf dem VPS: Sie übernimmt über eine lokale Brücke die Rohdaten jeder Meyton-Scheibe (Trefferlage auf 1/100 mm, Ring, Zehntel, Teiler, Zeit auf die Millisekunde) und macht daraus Schussbild, Serien, Analyse, Verläufe und Vergleiche. Zugeordnet wird automatisch per Sportpass-Opt-in, sonst per Meyton-QR samt Original-PDF. Open Source unter Apache-2.0, eine Installation je Verein.

# Spiegel — Wegweiser

> **Status:** Spiegel läuft seit dem 14. Oktober 2026 auf dem VPS (eigene Subdomain). Gebaut sind Fachkern, Brücke, Ingest-API, Opt-in mit Bestätigung der ersten Scheibe und die Bereiche Start, Scheiben, Fortschritt, Offen und Profil. Offen sind vor allem der QR-Weg (SP-1.7 b) und die Brücke im Schützenhaus. Den Stand je Feature hält die [[spiegel-roadmap]].
>
> **Rahmen:** nur 10-m-Stände (Luftgewehr, Luftpistole, Auflage), etwa 10 bis 15 Nutzer, keine Gäste und Jugendlichen, der VPS bleibt bei 2 GB. Schützen im Gäste-LAN, Anlage und Brücke im Gerätenetz; beide werden nach dem Training hart ausgeschaltet.

## So arbeiten wir an Spiegel

1. In der [[spiegel-roadmap]] das nächste offene Feature wählen, dessen Abhängigkeiten erledigt sind.
2. `/plan` mit Verweis auf den Feature-Abschnitt und die dort genannten Sonderfälle (SF-IDs aus [[spiegel-edge-cases]]); der Plan landet in `plans/<datum>-spiegel-<feature>.md`.
3. `/implement` → `/validate` → `/review`, Merge nach `main` nur mit OK.
4. Status des Features in der Roadmap nachziehen. Neue Entscheidungen werden ADRs, neues Wissen kommt in die passende Note dieses Ordners.

Features, die Deploy-Vertrag, Schema oder ADRs berühren, laufen interaktiv statt autonom (siehe [[autopilot-guard-blocks-contract-only-plans]]).

## Lesereihenfolge

1. [[spiegel-vision]] — Ziel, Abgrenzung zu Treffsicher und ShotsApp, Leitprinzipien.
2. [[spiegel-architecture]] — Komponenten, Datenfluss, Einbindung ins Vereinsheim, Open-Source-Betrieb.
3. [[spiegel-bridge]] (eingerichtet auf dem Pi nach [[spiegel-bridge-pi]]) und [[spiegel-ingest-pipeline]] — der Weg der Daten aus dem Schützenhaus; [[spiegel-ingest-contract]] — der Vertrag dazwischen (Snapshot, Prüfsumme, Testvektoren).
4. [[spiegel-assignment]] — wem eine Scheibe gehört und wann das feststeht.
5. [[spiegel-data-model]], [[spiegel-target-library]], [[spiegel-metrics]] — der Fachkern; [[spiegel-db-schema]] — die Datenbank (Schema, Zugriffe, Messung); [[spiegel-statistics]] — der Statistik-Katalog (was Spiegel auswertet und wann); [[spiegel-statistics-help]] — jede Auswertung in einfacher Sprache erklärt, erzeugt aus `packages/shot-help`, das auch die Hilfe in der App liefert.
6. [[spiegel-edge-cases]] — Sonderfälle und Fallstricke mit IDs (SF-xx), Grundlage der Testdaten und Abnahmen.
7. [[spiegel-ui-design]] — Design 2, Navigation, Bildschirme, Farben; [[spiegel-mobile]] — Spiegel auf dem Telefon; [[spiegel-langzeit]] — über viele Scheiben: Zeitraum, Verlauf, Analyse; [[spiegel-vergleichen]] — A gegen B auf einer eigenen Seite; [[spiegel-navigation]] — Einstieg, Scheiben-Liste, Auswahl, Adressen und Löschen; [[spiegel-durchsicht]] — Bedienbarkeit und Komplexität, Leitlinie „drei Ebenen“.
8. [[spiegel-privacy]] — Datenschutz, Rollen, verdeckte Wertung.
9. [[spiegel-roadmap]] und [[spiegel-open-questions]] — was wir wann bauen und was noch offen ist.
10. [[spiegel-account-transfer]] — Übernahme aus Treffsicher: Abgleich der Konten, Zuordnung als Datei, Lauf je Konto (`transfer`).
11. [[spiegel-diary]] — das Tagebuch als zweiter Teil: Einträge, Fragen, Ziele, Abläufe, Stellen im Ergebnisteil, Deine Daten.

## Domänenwissen

Alles über die Meyton-Anlage steht im Thema [[meyton]]: die Datenbank [[meyton-ssmdb2]], die weiteren Schnittstellen [[meyton-interfaces]] und der Ergebnisausdruck mit QR-Code [[meyton-printout]].

## Entscheidungen

- [[adr-026]] — Spiegel als dritte App mit eigener DB; der Schnitt zu Treffsicher ist durch [[adr-033]] abgelöst.
- [[adr-033]] — eine App mit zwei getrennten Teilen (Ergebnisse, Tagebuch), eine Statistik, Scheiben mit ihren
  Angaben; Treffsicher geht in den Ruhestand.
- [[adr-027]] — Brücke als lokaler Lese-Agent: nur lesend, nur ausgehend, Rohdaten unverändert.
- [[adr-028]] — Zuordnung per Meyton-QR mit Original-PDF, Sportpass automatisch, Fundbüro als Rückfall.
- [[adr-029]] — Apache-2.0 für das ganze Monorepo, Spiegel als selbst gehostete Software je Verein.
- [[adr-030]] — Design 2 mit Spiegel als Pilot.
- [[adr-031]] — Datenbank: Rohdaten als Zeilenversionen, Revisionen als Korrekturen, Projektion je Scheibe.

## Material

- **Konzeptseite mit klickbarem Prototyp:** `vault/_attachments/spiegel-konzept.html`, lokal im Browser öffnen. Dieselbe Seite liegt als privates Artifact „Spiegel Schussdaten-Konzept“ unter https://claude.ai/artifact/QJJ7Hjqi536Ha3Zw8Ct7Ym.
- **Beispiel-Ausdruck vom 2. Oktober 2026:** nicht im Repo, weil er Namen und Nummer enthält. Die Erkenntnisse stehen in [[meyton-printout]].
- **Bestehende Meyton-Importe:** [[treffsicher-meyton-import]] (Treffsicher) und [[meyton-import]] (Ringwerk).
