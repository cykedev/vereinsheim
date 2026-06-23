# vereinsheim

> **Open-source, self-hosted software for sport-shooting clubs.** Two web apps that run
> side by side on a single server: **Ringwerk** for leagues & competitions, and
> **Treffsicher** as a training log for individual shooters.

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Self-hosted](https://img.shields.io/badge/self--hosted-Docker-2496ed)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

Sport-shooting clubs are badly served by software — most run on paper, spreadsheets, or
nothing at all. These two apps cover the whole loop: running club competitions, and helping
each shooter train. Self-host both on one small VPS; your members' data never leaves your server.

<!-- TODO: add a screenshot or GIF here — the single biggest conversion lever.
     Suggested: a 2-up of the Ringwerk standings/bracket and the Treffsicher statistics page,
     rendered against anonymous sample data. -->
<!-- ![Ringwerk & Treffsicher](docs/assets/screenshot.png) -->

**▶ Live demo:** _coming soon_ · **Docs:** [spec](docs/spec.md) · [architecture decisions](docs/decisions.md) · [operations](docs/operations.md)

---

## The two apps

### 🎯 Ringwerk — competitions & leagues

Run your club's entire competitive program from one place.

- **Three formats on one scoring engine:** _League_ (round-robin schedule → standings →
  knockout playoffs), _Event_ (one-off shoots, ranked), _Season_ (months-long, best individual series)
- **8 configurable scoring modes** (ring-divisor, rings, target-value, …) with per-discipline
  correction factors for mixed disciplines
- **Playoff brackets:** best-of-N, finals with tiebreakers and sudden death
- Participant pool with guests, roles (admin / manager / viewer), and a full **audit log**
- **Meyton** electronic-target import (URL & PDF)
- **Public result PDFs** at a stable URL — link standings straight from your club website

### 📈 Treffsicher — training log for shooters

A training diary that takes mental training as seriously as the score.

- **Sessions** for training, competition, dry-fire and mental work; log results by series or
  per shot, with whole-/tenth-ring validation
- **Integrated mental training:** well-being tracking (sleep / energy / stress / motivation),
  pre-session forecast vs. post-session feedback on a 7-dimension self-assessment radar
- **Statistics:** result trends, shot distribution over time, well-being correlations, per-session histograms
- Season goals, editable shot-routine documents, **Meyton** PDF import
- Multi-user with strict per-user data isolation; focused dark-mode UI

---

## Try it locally (one command)

Requires Node ≥ 24 and Docker.

```bash
git clone https://github.com/cykedev/vereinsheim.git
cd vereinsheim
./scripts/vereinsheim dev-setup     # toolchain, dev Postgres, env, schema — idempotent
pnpm dev                            # Ringwerk on :3000, Treffsicher on :3001
```

Deploy both to your own VPS (Docker images → single server, Caddy + automatic HTTPS):
see [docs/operations.md](docs/operations.md).

---

## Under the hood

Beyond the apps, this repo is a **real-world reference** for shipping multiple Next.js apps:

- **Turborepo monorepo** — two Next.js 16 apps + shared `packages/` (ui, lib, config), pnpm catalog
- **Single-VPS deploy** — `turbo prune` → Docker images → one server; Caddy reverse proxy with
  automatic Let's-Encrypt TLS; one Postgres with **two isolated databases** (cross-DB access made
  technically impossible)
- **Ops CLI** (`vereinsheim`) — build · release · deploy · backup/restore · migrations, with
  pre-deploy backups and migration-failure recovery
- **AI agent harness for Claude Code** — ADR-driven docs, a built knowledge-graph index, hooks
  (quality gate on every turn, protected-path guard for autonomous runs), reusable skills, and a
  plan → implement → validate → review workflow

| Layer     | Tech                                          |
| --------- | --------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19             |
| Language  | TypeScript (strict)                           |
| Database  | PostgreSQL 15 + Prisma 7                       |
| Auth      | NextAuth.js v4                                 |
| UI        | shadcn/ui + Tailwind CSS 4 · Recharts         |
| Tooling   | pnpm + Turborepo · Vitest                     |
| Deploy    | Docker · Caddy · single VPS                    |

Development workflow and architecture rationale: [CLAUDE.md](CLAUDE.md) · [docs/decisions.md](docs/decisions.md).

---

## Contributing

Issues and PRs welcome. The apps' UI is in **German** (their user base is German-speaking
shooting clubs); code, identifiers and commit messages are in English.

## License

[Apache-2.0](LICENSE).

---

## Auf Deutsch

**Open-Source-Software für Schützenvereine, self-hosted.** Zwei Web-Apps auf einem Server:
**Ringwerk** (Wettkämpfe & Liga: Spielplan, Tabelle, K.-o.-Playoffs, 7 Wertungsmodi, Event-
& Saison-Wettbewerbe, öffentliche Ergebnis-PDFs, Meyton-Import) und **Treffsicher**
(Trainingstagebuch für Sportschützen: Einheiten, Ergebniserfassung, integriertes Mentaltraining,
Befinden-Tracking, Statistiken). Lokal starten: `./scripts/vereinsheim dev-setup` → `pnpm dev`.
Deployment & Betrieb: [docs/operations.md](docs/operations.md).
