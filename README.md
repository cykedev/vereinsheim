# vereinsheim

> **Open-source, self-hosted software for sport-shooting clubs.** Three web apps that run side by side on a single
> server: **Ringwerk** for leagues & competitions, **Treffsicher** as a training log, and **Spiegel** for the raw shot
> data of a Meyton electronic target system, fed by a small bridge in the clubhouse.

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Go](https://img.shields.io/badge/Go-bridge-00add8)
![Self-hosted](https://img.shields.io/badge/self--hosted-Docker-2496ed)

Sport-shooting clubs are badly served by software — most run on paper, spreadsheets, or nothing at all. These apps
cover the whole loop: running club competitions, helping each shooter train, and turning every shot the range records
into something a shooter can learn from. Self-host them on one small VPS; your members' data never leaves your server.

**Docs:** [overview](vault/overview.md) · [architecture decisions](vault/decisions/decisions.md) ·
[operations](vault/operations/operations.md) · [Spiegel](vault/spiegel/spiegel.md)

---

## The apps

### 🎯 Ringwerk — competitions & leagues

Run your club's entire competitive program from one place.

- **Three formats on one scoring engine:** _League_ (round-robin schedule → standings → knockout playoffs), _Event_
  (one-off shoots, ranked), _Season_ (months-long, best individual series)
- **8 configurable scoring modes** (ring-divisor, rings, target-value, …) with per-discipline correction factors for
  mixed disciplines
- **Playoff brackets:** best-of-N, finals with tiebreakers and sudden death
- Participant pool with guests, roles (admin / manager / viewer), and a full **audit log**
- **Meyton** electronic-target import (URL & PDF)
- **Public result PDFs** at a stable URL — link standings straight from your club website

### 📈 Treffsicher — training log for shooters

A training diary that takes mental training as seriously as the score.

- **Sessions** for training, competition, dry-fire and mental work; log results by series or per shot, with
  whole-/tenth-ring validation
- **Integrated mental training:** well-being tracking (sleep / energy / stress / motivation), pre-session forecast vs.
  post-session feedback on a 7-dimension self-assessment radar
- **Statistics:** result trends, shot distribution over time, well-being correlations, per-session histograms
- Season goals, editable shot-routine documents, **Meyton** PDF import
- Multi-user with strict per-user data isolation

### 🔍 Spiegel — every shot from the range

Spiegel reads what the club's Meyton system records — position to 1/100 mm, ring, tenth, divisor, time to the
millisecond — and shows it to the shooter who fired it.

- **One card, every shot:** target with all shots, series, shot table, official and tenth scoring, and an analysis in
  six tabs (position, spread, timing, trend, …) with plain-language help for every metric
- **Progress over weeks:** trend, volume, training calendar, comparison and personal records for any period
- **Private by default:** a card is assigned to a shooter only after they opt in with their sports-pass number; admins
  manage accounts but never see other people's shots; hidden scoring modes never leave the range
- **The bridge** ([`apps/spiegel-bridge`](apps/spiegel-bridge)) is a single static Go binary on a Raspberry Pi or
  mini PC next to the Meyton server. It only reads, only connects outbound, keeps nothing but its config on disk, and
  survives being switched off hard after every training night.

UI language is German; Spiegel uses a light/dark design (Design 2), Ringwerk and Treffsicher run in dark mode.

---

## Getting started

Requires Node ≥ 24 (see `.nvmrc`), pnpm, Go ≥ 1.24 and Docker.

```bash
git clone https://github.com/cykedev/vereinsheim.git
cd vereinsheim
./scripts/vereinsheim dev-setup     # toolchain, dev Postgres, .env files, schema — idempotent
pnpm dev                            # Ringwerk :3000, Treffsicher :3001, Spiegel :3002
```

`dev-setup` starts the shared dev Postgres from `docker-compose.dev.yml` (databases `ringwerk`, `treffsicher`,
`spiegel`) and creates each app's `.env` from its `.env.example`. Each app creates its first admin account on first
start from the admin email and password in its `.env`.

The quality gate runs lint, format check, tests, type check and build for every package:

```bash
pnpm check
```

App details: [Ringwerk](apps/ringwerk/README.md) · [Treffsicher](apps/treffsicher/README.md) ·
[Spiegel](apps/spiegel/README.md) · [Spiegel bridge](apps/spiegel-bridge/README.md)

## Deploying

Images are built locally from the monorepo (`turbo prune`, one parameterized `Dockerfile`), pushed to Docker Hub and
pulled by the server. `compose.yml` runs Caddy (automatic HTTPS), one Postgres with one database and owner per app,
and per app a one-shot migrator before the app container.

```bash
./scripts/vereinsheim local-setup   # once: VPS host, repo path, Docker Hub user
./scripts/vereinsheim release       # build + push all apps, then deploy on the VPS
./scripts/vereinsheim help          # everything else: backup, restore, rollback, logs, psql, …
```

Server setup, `.env`, deploy, backups and recovery: [vault/operations/operations.md](vault/operations/operations.md).
Installing the bridge at the range: [apps/spiegel-bridge/README.md](apps/spiegel-bridge/README.md).

---

## Under the hood

| Layer     | Tech                                                  |
| --------- | ----------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19                     |
| Language  | TypeScript (strict); Go for the bridge                |
| Database  | PostgreSQL 15 + Prisma 7                              |
| Auth      | NextAuth.js v4                                        |
| UI        | shadcn/ui + Tailwind CSS 4 · Recharts                 |
| Tooling   | pnpm + Turborepo · Vitest                             |
| Deploy    | Docker · Caddy · single VPS · ops CLI `vereinsheim`   |

```
apps/
  ringwerk/          leagues & competitions
  treffsicher/       training log
  spiegel/           Meyton shot data
  spiegel-bridge/    bridge at the range (Go)
packages/
  config, lib, ui    shared tooling config, utilities, UI primitives
  shot-core          scoring like Meyton, target geometry, metrics, projection per card
  shot-ui            Spiegel's React building blocks
  shot-help          plain-language help for every metric
  ingest-contract    bridge ↔ Spiegel contract (snapshot v1, checksum, test vectors)
  ssmdb2-cases       edge-case test data replaying Meyton's database
  meyton-pdf         reads ID and creation time from Meyton printouts
scripts/             ops CLI and the scripts it wraps
tools/stack-e2e/     the whole stack end to end with the real images
vault/               documentation: specs, ADRs, operations (an Obsidian vault)
```

The repo also carries an **agent harness for Claude Code**: ADR-driven docs in `vault/` served as a knowledge graph,
hooks (quality gate at the end of every turn, protected-path guard for autonomous runs), reusable skills, and a
plan → implement → validate → review workflow. See [CLAUDE.md](CLAUDE.md).

---

## Contributing

Issues and PRs welcome. The apps' UI is in **German** (their users are German-speaking shooting clubs); code,
identifiers and commit messages are in English, docs in `vault/` are German.

## License

[Apache-2.0](LICENSE).

---

## Auf Deutsch

**Open-Source-Software für Schützenvereine, selbst gehostet.** Drei Web-Apps auf einem Server: **Ringwerk**
(Wettkämpfe & Liga: Spielplan, Tabelle, K.-o.-Playoffs, 8 Wertungsmodi, Event- & Saison-Wettbewerbe, öffentliche
Ergebnis-PDFs, Meyton-Import), **Treffsicher** (Trainingstagebuch: Einheiten, Ergebniserfassung, Mentaltraining,
Befinden, Statistiken) und **Spiegel** (jeder Schuss aus der Meyton-Anlage mit Schussbild, Serien, Kennzahlen und
Verlauf, zugeordnet per Sportpassnummer nach Zustimmung). Die Daten für Spiegel liefert eine Brücke im Schützenhaus,
die nur liest und nur ausgehend verbindet.

Lokal starten: `./scripts/vereinsheim dev-setup` → `pnpm dev`. Deployment & Betrieb:
[vault/operations/operations.md](vault/operations/operations.md). Brücke einrichten:
[apps/spiegel-bridge/README.md](apps/spiegel-bridge/README.md).
