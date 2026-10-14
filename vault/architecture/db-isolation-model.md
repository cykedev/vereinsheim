---
id: db-isolation-model
type: concept
title: "db-isolation-model"
keywords: [DB-Isolation, Datenbanktrennung, zwei Datenbanken, getrennte DBs, Postgres, database isolation, Owner-User, Cross-DB, Mandanten]
tags: [ops-constraint]
relates_to: ["[[overview]]"]
governed_by: ["[[adr-002]]"]
part_of: ["[[architecture]]"]
documented_in: ["[[architecture#Build & Deploy (ADR-005/006/007/015)]]"]
---

**TL;DR** Ein Postgres-Container, drei DBs + drei Owner-User (ringwerk, treffsicher, spiegel; Spiegel seit P3, Oktober 2026); Cross-DB-Zugriff technisch unmöglich. Auf einem laufenden System legt `scripts/db-ensure.sh` fehlende DBs an.
