# Plan: Release-Build beschleunigen — lokale Quick-Wins (A+B)

> PIV-Handoff-Artefakt. **Freigegebener Scope: A (Rosetta) + B (`.next/cache`).**
> C (nur geänderte App bauen) und D (Kleinkram) sind **zurückgestellt** — s. Abschnitt am Ende;
> Entscheidung über C fällt anhand der gemessenen Zahlen. Kein CI / keine neue Infra / keine ADR
> aufgemacht. Läuft im **aktuellen Tree** auf `feat/faster-release-build` (kein Worktree, ADR-024).

## Context (warum)

`vereinsheim release` (→ [`scripts/build-and-push.sh`](../scripts/build-and-push.sh)) dauert lange.
Diagnose (in dieser Session verifiziert):

1. **Emulation ist der Hauptfaktor.** Host = **arm64** (Apple Silicon, 12 Cores / 32 GB), Build =
   `--platform linux/amd64`. Der teure `builder`-Stage ([`Dockerfile`](../Dockerfile) Z. 27–32:
   `turbo run build` = `next build` + `prisma generate`) läuft damit emuliert. Docker-Desktop-Settings
   (`settings-store.json`) enthalten **keinen Rosetta-Key** → die Emulation läuft vermutlich über
   **QEMU** (typ. 3–6× langsamer als nativ) statt über Rosetta (deutlich schneller). → **Hebel A**
2. **Kein `.next/cache` über Releases hinweg.** `turbo.json` schließt `.next/cache` bewusst aus den
   Task-Outputs aus, und der Docker-`builder` hat keinen persistenten Mount → **jeder `next build` ist
   ein Cold-Build**. Die gesamte (emulierte) Webpack/SWC-Arbeit fällt jedes Mal neu an. → **Hebel B**

Ziel: die zwei billigsten, risikoärmsten Hebel ziehen. Beide berühren weder den Deploy-Vertrag noch
eine ADR — es sind eine warnende Skriptzeile (A) und eine Dockerfile-Zeile (B).

## Approach

- **A — Rosetta statt QEMU:** Docker-Desktop-Setting aktivieren (GUI, durch den User) + eine **rein
  warnende** Preflight-Prüfung in `build-and-push.sh`, die auf fehlendes Rosetta hinweist. Größter
  Einzelhebel auf den emulierten `next build`.
- **B — `.next/cache` cachen:** BuildKit-cache-mount im `builder`-Stage → Folge-Builds derselben App
  werden inkrementell, es fällt weniger (emulierte) Arbeit an.

Trennung nach PIV-Phase: die **Code-Änderungen** (A2, B1) sind `/implement`; die **GUI-Aktivierung +
Vorher/Nachher-Messung** (A1, A0/A3/B2) sind `/validate` (brauchen den User / bewusst getimte Builds —
Memory: Docker-Build nicht neben `pnpm dev`, seriell).

## Files to change (Implement)

| Datei | Task | Änderung |
|-------|------|----------|
| [`scripts/build-and-push.sh`](../scripts/build-and-push.sh) | A2 | warnender Rosetta-Preflight nach dem `buildx`/`turbo`-Check (nach Z. 28) |
| [`Dockerfile`](../Dockerfile) | B1 | `builder`-Stage (Z. 32): BuildKit-cache-mount auf `.next/cache` |

Kein Eingriff in `compose.yml`, `deploy.sh`, `db-init/`, `Caddyfile`, das CLI (Deploy-Vertrag/Bedienung
unangetastet).

## Required Docs (vor Implementierung lesen)

- [`Dockerfile`](../Dockerfile) — Stages `deps`/`builder`/`runner`/`migrator`, Pfad `/app/apps/${APP}/`.
- [`scripts/build-and-push.sh`](../scripts/build-and-push.sh) — Check-Block Z. 27–28, PUSH-Modi.
- Vault: `monorepo-fast-build`, `adr-006`, `build-deploy-pipeline`.
- `vault/conventions.md` §8 (`next build` ist Pflicht-Gate).

---

## Tasks (/implement — je ein fokussierter Commit)

### B1. cache-mount im `builder`-Stage ([`Dockerfile`](../Dockerfile) Z. 32)

Ersetzt `RUN pnpm exec turbo run build --filter="${APP}"` durch:
```dockerfile
RUN --mount=type=cache,id=next-cache-${APP},target=/app/apps/${APP}/.next/cache \
    pnpm exec turbo run build --filter="${APP}"
```
- Pro-App-`id` (getrennte Caches ringwerk/treffsicher).
- Pfad verifiziert: `turbo prune --docker` legt die App unter `out/full/apps/<app>/` ab → im `builder`
  nach `COPY full/ .` unter `/app/apps/<app>/`; `next build` schreibt `…/.next/cache`.
- `# syntax=docker/dockerfile:1` (Z. 1) erlaubt Variablen im mount-`target`.
- **Commit:** `perf(build): cache .next/cache across image builds via BuildKit mount`

### A2. Warnender Rosetta-Preflight in `build-and-push.sh`

Nach dem `buildx`/`turbo`-Check (nach Z. 28) einfügen — **nie blockend**, nur Hinweis:
```bash
# Hinweis, wenn amd64 auf arm64-Host emuliert wird und Rosetta nicht aktiv ist (QEMU = langsam).
if [[ "$(uname -m)" == "arm64" && "$PLATFORM" == *amd64* ]]; then
	settings="$HOME/Library/Group Containers/group.com.docker/settings-store.json"
	if [[ -f "$settings" ]] && ! grep -qiE '"useVirtualizationFrameworkRosetta"[[:space:]]*:[[:space:]]*true' "$settings"; then
		echo "HINWEIS: amd64-Build auf arm64-Host ohne aktives Rosetta → Emulation läuft ggf. über QEMU" >&2
		echo "  (langsam). Docker Desktop → Settings → General → 'Use Rosetta for x86_64/amd64 …' beschleunigt." >&2
	fi
fi
```
- Steht im PUSH=1- **und** PUSH=0-Pfad sinnvoll (beide bauen amd64, wenn PLATFORM amd64 ist; bei PUSH=0
  ist `plat=()` nativ → `$PLATFORM` bleibt zwar `linux/amd64`, der Build ist aber nativ. Deshalb greift
  die Warnung strikt genommen am Release-Pfad; harmlos falls sie im lokalen Testbuild einmal erscheint).
- **Gate:** `bash -n scripts/build-and-push.sh`.
- **Commit:** `chore(build): warn when amd64 is emulated without Rosetta`

---

## Test steps (nach Implement, committeter Stand)

- **T-B (Cache greift, B1):** zwei aufeinanderfolgende `PUSH=0`-Builds derselben App ohne
  Quelländerung; der zweite ist schneller und das Log zeigt Next-Cache-Wiederverwendung statt Cold-Build.
  ```bash
  rm -rf out && PUSH=0 ./scripts/build-and-push.sh   # 1. Build füllt den Cache
  rm -rf out && PUSH=0 ./scripts/build-and-push.sh   # 2. Build sollte spürbar schneller sein
  ```
- **T-A (Preflight, A2):** vor Rosetta-Aktivierung erscheint der HINWEIS; nach Aktivierung (A1) nicht
  mehr. `bash -n scripts/build-and-push.sh` fehlerfrei.
- **T-Gate:** `pnpm check` (lint/format/test/tsc/**next build**) grün.
- **T-Image (funktional unverändert):** ein amd64-Runner-Image lädt & startet:
  `docker run --rm --platform linux/amd64 <user>/ringwerk:latest node -e 'console.log("ok")'`.

## Validate (mit User — GUI + Messung, in `reports/2026-07-15-faster-release-build.md`)

1. **A0 Baseline** (Gesamteffekt, den der User spürt): auf `main` (ohne A+B), aktuelle Docker-Settings,
   committeter Stand, kein paralleler Build:
   `git switch main && rm -rf out && /usr/bin/time -p env PUSH=0 ./scripts/build-and-push.sh 2>&1 | tail`
   → `real`-Zeit notieren, zurück auf `feat/faster-release-build`.
2. **A1 Rosetta aktivieren** (User, GUI): Docker Desktop → Settings → General → „Use Virtualization
   framework" an, „Use Rosetta for x86_64/amd64 emulation" an → Apply & Restart.
3. **A3/B2 Nachher-Messung**: auf `feat` (mit A+B), Rosetta aktiv: zwei Builds (1. füllt Cache, 2. warm).
   `real`-Zeiten notieren.
4. **Bericht**: Baseline vs. nachher als **Zahlen** (nicht „gefühlt schneller"); Erfolg = messbar
   kürzere `real`-Zeit. Optional den Rosetta- vs. Cache-Anteil trennen, falls von Interesse.

## Verification (Erfolgskriterium)

- Messbar kürzere Build-Zeit (Baseline → A+B), belegt mit Zahlen im `reports/`-Bericht.
- Funktional unverändert: die 4 Images bauen/laden wie zuvor (T-Image), `pnpm check` grün.
- Keine ADR verletzt, Deploy-Vertrag unangetastet (compose.yml/deploy.sh nicht berührt).

---

## Zurückgestellt (nicht dieser Durchlauf)

Bewusst außerhalb des freigegebenen Scopes — Analyse für später erhalten:

- **C — nur geänderte App(s) bauen/pushen.** Selektion via `turbo run build --filter='...[<base>]'
  --dry=json` gegen den letzten **Release**-SHA (aus einem Image-Label
  `org.opencontainers.image.revision`, stateless aus der Registry gelesen); die unveränderte App +
  ihr Migrator werden per `docker buildx imagetools create` **serverseitig auf den neuen SHA
  retagged** (kein Rebuild) → jeder SHA taggt beide Apps (ADR-006 gewahrt). Sicherer Default =
  Vollbau, Speed als opt-in (`FORCE_ALL=1` erzwingt Vollbau). Portabel ohne `mapfile` (bash 3.2).
  **Nutzen-Grenze:** hilft nur, wenn seit dem letzten Release *ausschließlich eine* App berührt wurde;
  Root-/`packages/*`-Änderungen bauen korrekt-konservativ beide.
- **D — Kleinkram.** `--pull` 1× statt 4× (mit `--platform "$PLATFORM"` im PUSH=1-Pfad, sonst native
  Base). `.dockerignore` **verworfen** (Build-Kontext `out/` von `turbo prune` enthält nachweislich kein
  `.git`/`node_modules`/`.next` → Repo-Root-`.dockerignore` griffe dort nicht).
