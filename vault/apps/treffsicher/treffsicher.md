---
id: treffsicher
type: guide
title: "Treffsicher"
keywords: [Treffsicher-App, Trainingsapp, Trainingstagebuch, Schießtraining, Mentaltraining, training app, diary, Port 3001, Design 2]
part_of: ["[[overview]]"]
---

**TL;DR** Trainings-App (Tagebuch, Ergebnisse, Statistik, Mentaltraining). apps/treffsicher, Dev-Port 3001, Design 2 hell und dunkel ([[treffsicher-design2]]). **Im Ruhestand** seit Stufe 4 von [[adr-033]]: läuft nicht mehr in Prod, unter ihrem Host steht eine Hinweisseite auf Spiegel, die Daten bleiben bis zum 1. Februar 2027.

MOC-Hub der Treffsicher-App (Training). Führt die App-Guides und die fachlichen Notes zusammen.

## Status

Im Ruhestand seit Stufe 4 von [[adr-033]] (freigegeben am 2. November 2026). Alle Daten sind nach Spiegel umgezogen.
In Prod läuft kein Container von Treffsicher mehr; Caddy zeigt unter seinem Host für jede Adresse eine Hinweisseite mit
einem Link auf Spiegel. Datenbank, Anhänge und Backups bleiben bis zum Löschtermin am 1. Februar 2027 ([[operations]]
„Treffsicher im Ruhestand“). Der Code bleibt vorerst im Repo, läuft in Dev und steht im Konsistenz-Gate; die Notes
unten beschreiben die App, wie sie war.

## Guides & Notes

- [[treffsicher-design2]] — Treffsicher in Design 2 (Rahmen, Darstellung, Dialoge, Hilfe)
- [[treffsicher-read-only]] — Treffsicher lesend je Konto: ein Konto, das nach Spiegel umgezogen ist
- [[dark-mode-only]] — dark-mode-only (abgelöst)
- [[file-attachments]] — file-attachments
- [[mental-modules]] — mental-modules
- [[result-recording-validation]] — result-recording-validation
- [[seasonal-goals]] — seasonal-goals
- [[shot-routines]] — shot-routines
- [[statistics-visualization]] — statistics-visualization
- [[training-session-types]] — training-session-types
- [[training-sessions]] — training-sessions
- [[treffsicher-access-model]] — treffsicher-access-model
- [[treffsicher-backlog]] — Treffsicher — Backlog
- [[treffsicher-code-conventions]] — Treffsicher — Code Conventions & Testing
- [[treffsicher-data-model]] — Treffsicher — Datenmodell & Domänen-Specs
- [[treffsicher-disciplines]] — treffsicher-disciplines
- [[treffsicher-dos-protection]] — treffsicher-dos-protection
- [[treffsicher-implementation-plan]] — Treffsicher — Implementierungsstatus
- [[treffsicher-meyton-import]] — treffsicher-meyton-import
- [[treffsicher-modularity-rules]] — treffsicher-modularity-rules
- [[treffsicher-requirements]] — Treffsicher — Fachliche Anforderungen
- [[treffsicher-server-actions]] — treffsicher-server-actions
- [[treffsicher-tech-stack]] — treffsicher-tech-stack
- [[treffsicher-technical-constraints]] — Treffsicher — Technische Rahmenbedingungen
- [[treffsicher-testing-conventions]] — treffsicher-testing-conventions
- [[treffsicher-user-isolation]] — treffsicher-user-isolation
- [[wellbeing-tracking]] — wellbeing-tracking
