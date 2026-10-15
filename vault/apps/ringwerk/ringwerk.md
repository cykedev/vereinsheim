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

