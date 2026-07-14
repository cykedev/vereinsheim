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

**TL;DR** Ein Postgres-Container, zwei DBs + zwei Owner-User (ringwerk, treffsicher); Cross-DB-Zugriff technisch unmöglich.
