---
id: compose-up-restarts-one-shot-containers
type: incident
title: "docker compose up startet beendete Migratoren erneut"
keywords: [docker compose, compose up, remove-orphans, no-deps, one-shot, einmalig, migrator, migrate, depends_on, service_completed_successfully, wait, deploy, gleichzeitig, speicher, compose-version]
tags: [incident, operations]
relates_to: ["[[deploy-flow]]", "[[vps-resource-sizing]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 14. Oktober 2026 (`scripts/deploy.sh`): Ein `docker compose up -d` ohne Dienstliste startet
auch einmalige Container neu, die schon mit Exit 0 beendet sind. Der Deploy startete die Migratoren erst nacheinander
je App und am Ende mit `up -d --remove-orphans` noch einmal alle gleichzeitig: genau die Speicherspitze, die das
Nacheinander vermeiden sollte. Behoben mit `up -d --remove-orphans --no-deps db caddy app-…`.

## Belegt

Wegwerf-Projekt mit zwei Migratoren und zwei Apps (`service_completed_successfully`): nach dem Nacheinander hatten
beide Migratoren nach dem abschließenden `up -d` denselben `StartedAt`; mit `--no-deps` und Dienstliste blieb er
unverändert. `tools/stack-e2e/ops.sh` prüft seitdem, dass jeder Migrator erst nach dem Ende des vorigen startet.

## Regel

- Nach einem gezielten Start einzelner Dienste den Abgleich nur mit `--no-deps` und Dienstliste, ohne die
  einmaligen Container.
- `up -d app-x` wartet über `depends_on` (`service_completed_successfully`) selbst auf den Migrator und endet mit einem
  Fehler, wenn er scheitert. `--wait` braucht es dafür nicht, und es verhält sich je nach Compose-Version bei
  beendeten Containern anders; den laufenden Zustand der App selbst prüfen (Status, Neustarts).
