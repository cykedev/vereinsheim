---
id: ops-cli-introspection
type: operation
title: "ops-cli-introspection"
keywords: [Ops-CLI, Kommandozeile, Betriebs-Tool, vereinsheim-Skript, status logs psql, CLI, Diagnose, Werkzeug, docker compose Wrapper]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-011]]"]
documented_in: ["[[operations#Das Werkzeug: `./scripts/vereinsheim`]]"]
---

**TL;DR** ./vereinsheim status/env-check/logs/shell/psql/migrations/up|down|restart — Diagnose + Service-Steuerung für alle Apps aus `APPS` (Wrapper um docker compose, ADR-011); `VEREINSHEIM_ENV_FILE` für Tests gegen den Teststack.
