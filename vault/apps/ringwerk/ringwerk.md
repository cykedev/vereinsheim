---
id: ringwerk
type: guide
title: "Ringwerk"
keywords: [Ringwerk-App, Ligaverwaltung, Wettkampfverwaltung, Vereinsliga, Schießsport, league app, competition management, Liga-App, Port 3000]
part_of: ["[[overview]]"]
---

**TL;DR** Liga- & Wettkampf-Verwaltung. apps/ringwerk, Dev-Port 3000.

MOC-Hub der Ringwerk-App (Liga & Wettkämpfe). Führt die App-Guides und die fachlichen Notes zusammen.

## Guides & Notes

- [[audit-logging]] — audit-logging
- [[best-of-single]] — best-of-single
- [[club-wide-data-rule]] — club-wide-data-rule
- [[color-semantics]] — color-semantics
- [[competition-types]] — competition-types
- [[data-flow-principle]] — data-flow-principle
- [[disciplines-and-factors]] — disciplines-and-factors
- [[event-mode]] — event-mode
- [[event-teams]] — event-teams
- [[factor-correction]] — factor-correction
- [[feature-module-layout]] — feature-module-layout
- [[league-mode]] — league-mode
- [[league-points-and-tiebreak]] — league-points-and-tiebreak
- [[meyton-import]] — meyton-import
- [[participants-and-enrollment]] — participants-and-enrollment
- [[pdf-public-urls]] — pdf-public-urls
- [[permission-matrix]] — permission-matrix
- [[phase-locking-and-editability]] — phase-locking-and-editability
- [[playoffs-knockout-system]] — playoffs-knockout-system
- [[prisma7-conventions]] — prisma7-conventions
- [[ringwerk-architecture]] — Ringwerk — Architektur – Ringwerk
- [[ringwerk-auth-security]] — ringwerk-auth-security
- [[ringwerk-code-conventions]] — Ringwerk — Code Conventions – Ringwerk
- [[ringwerk-data-model]] — Ringwerk — Datenmodell & Glossar – Ringwerk
- [[ringwerk-features]] — Ringwerk — Funktionale Anforderungen – Ringwerk
- [[ringwerk-project-brief]] — Ringwerk — Project Brief: Ringwerk
- [[ringwerk-reference-files]] — Ringwerk — Reference Files
- [[ringwerk-technical]] — Ringwerk — Technische Anforderungen – Ringwerk
- [[ringwerk-testing-conventions]] — ringwerk-testing-conventions
- [[ringwerk-ui-patterns]] — Ringwerk — UI-Patterns – Ringwerk
- [[ringwerk-worktrees]] — Ringwerk — Git Worktrees – Bekannte Einschränkungen
- [[role-based-access]] — role-based-access
- [[row-action-pattern]] — row-action-pattern
- [[scoring-engine]] — scoring-engine
- [[season-mode]] — season-mode
- [[series-unified-model]] — series-unified-model
- [[server-action-pattern]] — server-action-pattern
- [[void-match-rendering]] — void-match-rendering

## Offene Einzelpunkte (Stand 12. Oktober 2026)

- **Playoffs ohne Spielplan:** `startPlayoffs` (`src/lib/playoffs/actions/start.ts`) prüft nicht, ob ein Spielplan
  erzeugt ist. Eine Liga ohne Paarungen hat keine offenen Paarungen und könnte starten, sobald genug aktive Teilnehmer
  da sind. Vorschlag: eine eigene Prüfung „Spielplan erzeugt“.
- **PDF:** Die Spaltenköpfe der Tabellen wiederholen sich auf Folgeseiten nicht (etwa Event-Rangliste, Seite 2).
- **Zwei Gates sind vorgeschlagen, aber nicht entschieden:** ein Gate vor jedem Commit (ein Commit lief einmal
  trotz rotem `check-types`) und ein Schritt „Datenlage abgleichen“ im Skill `/validate`.

**Fachlich, mit der Sportleitung zu klären**

- **Rückzug sperrt den Playoff-Start:** `start.ts` zählt alle offenen Paarungen, auch die mit Zurückgezogenen; für diese
  gibt es keine Ergebniseingabe. Eine Liga mit einem Rückzug während der Saison kann so nie Playoffs starten. Beim
  Zählen nur Paarungen ohne zurückgezogene Teilnehmer berücksichtigen, mit Test.
- **Gruppenergebnisse bleiben nach dem Playoff-Start änderbar** (`saveBestOfDuel`, `saveMatchResult` ohne Sperre); die
  nächste Runde wird dann aus der geänderten Tabelle gesetzt. Sperren wie Rückzug und Spielplan, oder bewusst zulassen
  ([[phase-locking-and-editability]]).
- **Playoff-Grenze trennt einen geteilten Platz:** Platz 4 und 5 zeigen beide „4“, aber nur einer kommt weiter.
  Vorschlag: beim Start warnen, wenn der letzte und der erste nicht qualifizierte Platz gleich sind.
- **Event im Wertungsmodus RINGS:** Gleiche Ringe teilen den Platz unabhängig vom Teiler. Ob ein Teiler-Tiebreak
  gewünscht ist, ist offen.
- **„Wiederholungsduell“ (`groupHasSuddenDeath = false`) hat keine Wirkung:** Formular, Schema und Actions speichern
  den Schalter, ausgewertet wird er nirgends; entschieden wird immer per Stechschuss. Umsetzen oder die Option entfernen.
- **Ausschreibungs-Vorlage für den Best-of-Modus** gibt es nur noch in der Git-History, mit Platzhaltern und veraltet
  (Stechschuss als 1:1 statt 2:1, alte Reihenfolge der Tabelle). Aktualisiert zu [[best-of-single]] legen oder verwerfen.

**Fehler und Lücken im Code**

- **Liga-PDFs runden Zehntelringe bei gemischter Disziplin:** Die PDF-Routen (Spielplan, Playoffs, öffentlich)
  bestimmen den ScoringType einmal je Wettbewerb, bei gemischter Liga `WHOLE`; die Bildschirmansicht rechnet je
  Teilnehmer. Den ScoringType je Teilnehmer an `SchedulePdf` und `PlayoffsPdf` durchreichen (nur aus dem Code gelesen).
- **Teiler-Faktor im Best-of-Modus nur auf dem Server:** `bestOfStatus.ts`, `bestOfLabel.ts` und `RecordedDuelsList`
  rechnen mit Faktor 1; bei gemischter Best-of-Liga mit Teiler als Wertung oder Tiebreaker können Dialog und Anzeige
  vom Ergebnis des Servers abweichen (nur aus dem Code gelesen).
- **Kein Rate-Limit für das Passwort der öffentlichen PDF-Route:** mindestens vier Zeichen, je Anfrage ein
  bcrypt-Vergleich, aus dem Internet erreichbar ([[pdf-public-urls]]). Die Ratenbegrenzung aus `@vereinsheim/lib`
  mitnutzen oder das Risiko festhalten.
- **Wiederherstellen einer Disziplin** schreibt keinen Eintrag ins Audit-Log (nur das Archivieren).
- **Vier Aktionen ohne Erfolgs-Toast:** `DisciplineActions`, `AdvanceRoundButton`, `StartPlayoffsButton`,
  `UserRowActions` ([[conventions]] §2).
- **Grammatik im Statusdialog** (`CompetitionStatusActions.tsx`): „wird wieder öffnen“, „wird archivieren“.
- **Rohe Fehlerobjekte im Log** (`lib/matchups/actions.ts`, `app/(app)/competitions/page.tsx`); das Beispiel in
  [[ringwerk-code-conventions]] loggt selbst das rohe `error`.
- **Toter Code:** `formatParticipantName` (`lib/participants/formatters.ts`) nutzt nur sein Test; `EventConfig.discipline`
  steht als `@deprecated` in `rankEventParticipants.ts`. Löschen.
- **`"use client"`-Audit** (37 Dateien) wurde nie gemacht.
- **Schema:** `Series.matchup` steht auf `SET NULL`; wer eine Paarung löscht, hinterlässt Serien ohne Bezug.
  Vorschlag `onDelete: Restrict` (Schema und Migration interaktiv).
- **Tests:** `EventRankingPdf` und `SeasonStandingsPdf` haben keinen Test über mehrere Seiten (fester Kopf), anders als
  `PlayoffsPdf.test.tsx`.

**Abnahme und Prüfung im Betrieb**

- **QR-Code auf internen PDFs** nie in Produktion abgenommen: echte Domain hinter Caddy, Scan vom Papier (auch mit
  `?k=`), Texte an den Checkboxen im Formular.
- **Best-of-Playoffs vor dem Fix der Setzliste:** Ob eine Best-of-Liga mit dem alten Image Playoffs gestartet hat (dann
  wäre Runde 1 falsch gesetzt), ist nicht geprüft; die SQL-Abfrage aus [[best-of-playoff-seeding-round-robin-table]]
  einmal auf dem VPS ausführen.

