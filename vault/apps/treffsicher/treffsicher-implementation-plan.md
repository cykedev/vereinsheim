---
id: treffsicher-implementation-plan
type: guide
title: "Treffsicher — Implementierungsstatus"
aliases: ["Treffsicher — Implementierungsstatus & Roadmap"]
keywords: [treffsicher, implementierungsstatus, roadmap, Funktionsumfang, Phasen, Entwicklungsworkflow, pnpm check, Migration]
part_of: ["[[treffsicher]]"]
---

**TL;DR** Umgesetzter Funktionsumfang nach Phasen (1–5.1 vorhanden, 5.2 PWA/Offline offen) und der Entwicklungsablauf im Monorepo; offene Punkte stehen in [[treffsicher-backlog]].

# Treffsicher — Implementierungsstatus & Roadmap

Verbindliche Referenzdokumente: [[treffsicher-requirements]] · [[treffsicher-technical-constraints]]

---

## Phasen-Übersicht

| Phase | Inhalt                                                                                    | Status |
| ----- | ----------------------------------------------------------------------------------------- | ------ |
| 1     | Fundament: Auth, Disziplinen, Einheit-Minimal, Tagebuch                                   | ✅     |
| 2     | Erweiterte Ergebnisse, Uploads, Basis-Statistiken                                         | ✅     |
| 3     | Mentaltraining: Bearbeiten/Löschen, Befinden, Reflexion, Prognose/Feedback, Schuss-Ablauf | ✅     |
| 3.9   | UI-Überarbeitung: Dark Mode, Lucide-Icons, shadcn-Komponenten                             | ✅     |
| 3.10  | Favoriten, Trainingsziel, Schuss-/Probeschussanzahl im Tagebuch, Eingabevalidierung       | ✅     |
| 3.11  | Meyton-PDF Import (URL + Upload)                                                          | ✅     |
| 3.12  | Import-Sicherheits-Härtung (SSRF, PDF-Plausibilität)                                      | ✅     |
| 3.13  | DoS-Härtung: Streaming-Import, FormData-Limits, Statistik-Caps, Login-Rate-Limit          | ✅     |
| 4.1   | Saisonziele (CRUD + Einheits-Verknüpfung)                                                 | ✅     |
| 4.2   | Radarchart (7 Dimensionen Prognose vs. Feedback)                                          | ✅     |
| 4.3   | PDF-Export einzelner Einheit                                                              | ✅     |
| 5.1   | Admin-Bereich: Nutzerverwaltung, System-Disziplinen, Passwortwechsel                      | ✅     |
| 5.2   | PWA / Offline-Unterstützung                                                               | ⏳     |

---

## Offene Arbeitspakete

Offene Punkte, priorisiert, inkl. Phase 5.2 (PWA / Offline, T-06): [[treffsicher-backlog]]

---

## Entwicklungsworkflow

### Vor jeder Schemaänderung

1. Änderung in `apps/treffsicher/prisma/schema.prisma`
2. Migration (Dev-Postgres aus der Root-`docker-compose.dev.yml` muss laufen): `pnpm --filter treffsicher exec prisma migrate dev --name <name>`
3. Migration-Datei einchecken (`apps/treffsicher/prisma/migrations/`)
4. Keine destructiven Migrationen ohne Kommentar

### Vor jedem Commit (alle müssen grün sein)

```bash
pnpm check   # an der Repo-Wurzel: lint, format:check, test, check-types, build
```

### Bei gewachsenen Dateien (>220 Zeilen)

Split verpflichtend — Orchestrator-Seiten dünn halten.
Details: [[treffsicher-technical-constraints#Modularität & Wartbarkeit (verbindlich)]]

### Bei Widersprüchen zu Docs

Abweichung dokumentieren → klären → dann erst implementieren.
