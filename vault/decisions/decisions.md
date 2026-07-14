---
id: decisions
type: guide
title: "Architecture Decision Records"
keywords: [adr, decisions, entscheidungen, architektur-entscheidungen, begründungen, decision records]
part_of: ["[[overview]]"]
---

**TL;DR** Der ADR-Kanon von vereinsheim — 25 Entscheidungen mit Begründung. Vor architektur-berührenden Vorschlägen die betroffene ADR prüfen.

Kanonische Entscheidungshistorie. `supersedes`/`refines`-Kanten verbinden abgelöste und verfeinerte ADRs.

## ADRs

- [[adr-001]] — ADR-001 — Eigenes Repo `vereinsheim` für Deployment _(Superseded)_
- [[adr-002]] — ADR-002 — 1 Postgres-Container, 2 Datenbanken, 2 User
- [[adr-003]] — ADR-003 — Network-Split: `web` und `data`
- [[adr-004]] — ADR-004 — Caddy 2 als Reverse Proxy
- [[adr-005]] — ADR-005 — Docker Hub mit public Images
- [[adr-006]] — ADR-006 — Lokales Build statt CI
- [[adr-007]] — ADR-007 — Separates Migrator-Image pro App (eigener Tag)
- [[adr-008]] — ADR-008 — Konservative Migrations-Recovery-Konfiguration
- [[adr-009]] — ADR-009 — `pg_dump`-Cutover, gleiche Mechanik als Backup
- [[adr-010]] — ADR-010 — Pre-Deploy-Backup als Default
- [[adr-011]] — ADR-011 — `vereinsheim`-CLI als einziges Tool, Lokal-/VPS-Mode
- [[adr-012]] — ADR-012 — `.vereinsheim.local` für lokale Konfig, getrennt von `.env`
- [[adr-013]] — ADR-013 — `bootstrap-vps.sh` ohne automatischen SSH-Lockdown
- [[adr-014]] — ADR-014 — Firewall via IONOS Cloud-Panel, kein UFW im OS
- [[adr-015]] — ADR-015 — Monorepo: Apps in `vereinsheim` integrieren (supersedes ADR-001)
- [[adr-016]] — ADR-016 — Knowledge Graph für Claude Code (3 Schichten)
- [[adr-017]] — ADR-017 — Lessons/Wissens-Capture: stärkste Permanenz zuerst
- [[adr-018]] — ADR-018 — Harness Engineering: Hooks, PIV-Workflow, Sub-Agents
- [[adr-019]] — ADR-019 — App-Root-`.claude`-Layout + geteilte Root-Harness (realisiert ADR-016/017/018)
- [[adr-020]] — ADR-020 — Nativer PIV-Workflow; Superpowers-Plugin entfernt (supersedet Superpowers-Teil von ADR-018/019)
- [[adr-021]] — ADR-021 — Memory-Graph operationalisiert: Pfad-Fix, Lese-Hook, Schreib-Disziplin, Abgrenzung natives Auto-Memory
- [[adr-022]] — ADR-022 — Memory-Graph als gebauter, relationenreicher Doku-Index (Builder + Manifest + Captured + Fragment-Pointer) _(Superseded)_
- [[adr-023]] — ADR-023 — Implement-Phase autonom-by-default (realisiert ADR-018 §5, schärft ADR-020)
- [[adr-024]] — ADR-024 — Worktree-Wahl ist Hauptsession-Vorab-Entscheidung (schärft ADR-023 §5)
- [[adr-025]] — ADR-025 — Wissenssystem v3: Obsidian-Vault als einziger Wissensspeicher
