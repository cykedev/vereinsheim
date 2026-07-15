# Plan: Release-Build gegen Docker-Cache-Eviction absichern

> Ersetzt den reverteten A+B-Plan ([2026-07-15-faster-release-build.md](2026-07-15-faster-release-build.md)),
> dessen Hypothese (QEMU/`.next/cache`) sich als falsch erwies. Die echte Ursache wurde in dieser Session
> **gemessen** — siehe [reports/2026-07-15-faster-release-build.md](../reports/2026-07-15-faster-release-build.md).

## Context (warum)

`vereinsheim release` dauert beim User **5+ Minuten**. Belegte Diagnose:

- Rosetta ist aktiv (nicht QEMU) → Emulation ist **nicht** die Ursache. A+B brachten 0 → reverted.
- Der BuildKit-Layer-Cache funktioniert strukturell: bei einem Code-Change bleibt der `pnpm install`-Layer
  `CACHED`; ein **warmer** 1-App-Build = **~40s** (gemessen `real 40.66`, nur `next build` läuft).
- **Aber der Cache ist beim User meist kalt.** Docker ist mit **75 Images / ~126 GB** gefüllt — die
  Platzfresser sind **andere Projekte** (python/wordpress/php/solar-pv/mariadb). Der BuildKit-Cache ist
  ein **LRU-Pool über alle Projekte**; zwischen zwei vereinsheim-Releases verdrängt fremde Docker-
  Aktivität die vereinsheim-Layer → beim Release läuft alles kalt: 4 Images × ~77s ≈ **5 min**.
- vereinsheim selbst müllt lokal nicht (nur 8 Tags, ~1,2 GB).

**Ziel:** den vereinsheim-Release-Build **immun** gegen diese Eviction machen → Releases bleiben ~40–80s
statt 5 min, egal wie voll der Docker durch andere Projekte ist.

## Approach

Ein **persistenter lokaler Build-Cache außerhalb des Docker-GC-Pools**: ein dedizierter
`docker-container`-Builder + `--cache-to/--cache-from type=local,mode=max`, Cache in einem gitignorierten
Verzeichnis. Ein FS-Verzeichnis unterliegt **keiner** BuildKit-GC → übersteht jede Eviction.

- Nur der **`PUSH=1`-Pfad** (Release, amd64) bekommt den neuen Builder + Cache. Der `PUSH=0`-Pfad (lokaler
  Test, `--load`, nativ arm64) bleibt **unverändert** beim Default-Builder — er ist nativ und schnell,
  braucht keinen persistenten Cache, und so entfällt die `--load`-mit-`docker-container`-Sonderbehandlung.
- **`mode=max` ist Pflicht** — nur so werden die Zwischenstages (`deps`/`pnpm install`, `builder`/`next
  build`) gecacht. `inline`/`mode=min` cachet nur die finalen Layer → würde das Kernproblem (pnpm install
  + next build cachen) **nicht** lösen.
- **Pro `(app, target)` ein eigenes Cache-Verzeichnis** (`.buildcache/<app>-<target>/`). Ein gemeinsames
  Verzeichnis würde bei jedem der 4 Builds vom nächsten überschrieben → nur der letzte Cache bliebe.
- **Deploy-Vertrag unverändert:** gleiche Tags, gleiche Push-Ziele, gleiches Dockerfile. Nur Builder +
  Cache-Flags kommen dazu.

**PoC zuerst** (Task 1): die Kern-Annahme „local-cache übersteht Eviction" **beweisen**, bevor
`build-and-push.sh` (geschützter Pfad) angefasst wird. Das ist die direkte Lehre aus A+B — nicht wieder
etwas umbauen, dessen Wirkung ungeprüft ist.

## Files to change

| Datei | Task | Änderung |
|-------|------|----------|
| — (nur Befehle) | 1 | PoC: `docker-container`-Builder + local-cache-Roundtrip verifizieren |
| [`scripts/build-and-push.sh`](../scripts/build-and-push.sh) | 2 | Builder-Preflight (idempotent) + `--builder`/`--cache-to`/`--cache-from` im `PUSH=1`-Pfad |
| `.gitignore` | 3 | `.buildcache/` ergänzen |
| [`README.md`](../README.md) bzw. Vault-Note | 3 | Cache-Mechanismus + Management (löschen wenn zu groß) dokumentieren |

Dockerfile bleibt unverändert. `PUSH=0`/`cmd_local_build`, `compose.yml`, `deploy.sh` unberührt.

## Required Docs (vor Implementierung lesen)

- [`scripts/build-and-push.sh`](../scripts/build-and-push.sh) — `build_app()` (Z. ~42–74), Preflight (Z. ~27–38), PUSH-Modi.
- [reports/2026-07-15-faster-release-build.md](../reports/2026-07-15-faster-release-build.md) — die Messungen/Diagnose.
- Vault: `build-deploy-pipeline`, `adr-006` (lokaler Build), `monorepo-fast-build`.

---

## Tasks

### Task 1 — PoC: local-cache übersteht Eviction (BEWEIS vor Umbau)

Keine Datei-Änderung, nur Befehle. Erfolg = Grünes Licht für Task 2; Misserfolg = HALT + neu denken.
```bash
docker buildx inspect vereinsheim-cache >/dev/null 2>&1 || \
  docker buildx create --name vereinsheim-cache --driver docker-container
rm -rf out && pnpm exec turbo prune ringwerk --docker >/dev/null
C=.buildcache/ringwerk-runner
# (a) füllen
docker buildx build --builder vereinsheim-cache --platform linux/amd64 --target runner \
  --build-arg APP=ringwerk -f Dockerfile \
  --cache-to type=local,dest=$C,mode=max --cache-from type=local,src=$C --output type=cacheonly out
# (b) internen Builder-Cache leeren = Eviction simulieren (das $C-Verzeichnis bleibt!)
docker buildx prune -af --builder vereinsheim-cache
# (c) erneut bauen — MUSS aus $C warm kommen
docker buildx build --builder vereinsheim-cache --platform linux/amd64 --target runner \
  --build-arg APP=ringwerk -f Dockerfile \
  --cache-from type=local,src=$C --output type=cacheonly out 2>&1 | grep -E "pnpm install|CACHED|next build|DONE"
rm -rf out
```
**Erfolgskriterium:** in (c) zeigt der `deps`/`pnpm install`-Layer **`CACHED`** und `next build` läuft
nicht neu (bzw. ist deutlich verkürzt) — obwohl der interne Cache in (b) geleert wurde. Damit ist die
Immunität gegen Eviction bewiesen. Zeiten (a) vs (c) notieren.

### Task 2 — `build-and-push.sh`: Builder + local-cache im `PUSH=1`-Pfad

**2a. Preflight** (nach dem `turbo`-Check, nur wenn `PUSH=1`): idempotent den Builder sicherstellen.
```bash
BUILDER=""
if [[ "$PUSH" == "1" ]]; then
	BUILDER="vereinsheim-cache"
	docker buildx inspect "$BUILDER" >/dev/null 2>&1 || \
		docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
fi
```
**2b. In `build_app()`** die Cache-Flags + Builder ergänzen — pro `(app,target)` ein Cache-Dir. Der
`docker buildx build`-Aufruf bekommt im `PUSH=1`-Pfad zusätzlich:
```bash
	local cache_dir=".buildcache/${app}-${target}"
	local cache_args=()
	if [[ "$PUSH" == "1" ]]; then
		mkdir -p "$cache_dir"
		cache_args=(--builder "$BUILDER"
			--cache-from "type=local,src=${cache_dir}"
			--cache-to "type=local,dest=${cache_dir},mode=max")
	fi
	docker buildx build \
		--pull \
		"${cache_args[@]}" \
		"${plat[@]}" \
		-f Dockerfile --build-arg APP="$app" --target "$target" \
		--tag "${img}:${SHA}${suffix}" --tag "${img}:latest${suffix}" \
		"$out_flag" out
```
(`cache_dir`/`cache_args` müssen in der `for spec`-Schleife **nach** `target` gesetzt werden, da sie
`$target` nutzen.) `PUSH=0` → `cache_args` leer, `plat` leer, Default-Builder, `--load` → **exakt wie
bisher**. **Gate:** `bash -n scripts/build-and-push.sh`.

### Task 3 — .gitignore + Doku

- `.gitignore`: Zeile `.buildcache/` ergänzen (falls nicht vorhanden).
- Kurz dokumentieren (in `README.md` „Quick Reference" oder Vault `build-deploy-pipeline`): der Release
  nutzt einen persistenten local-Cache unter `.buildcache/`; er hält Releases warm trotz vollem Docker;
  bei Platzmangel `rm -rf .buildcache` (nächster Release baut einmalig kalt, füllt neu). Der
  `vereinsheim-cache`-Builder wird automatisch angelegt.

### Task 4 — Verifikation (siehe unten)

---

## Test steps

- **T1 (PoC, Task 1):** wie Erfolgskriterium Task 1 — `pnpm install` `CACHED` nach `buildx prune`.
- **T2 (Skript-Syntax):** `bash -n scripts/build-and-push.sh` fehlerfrei.
- **T3 (`PUSH=0` unverändert):** `PUSH=0 ./scripts/build-and-push.sh` baut alle 4 Images wie bisher
  (Default-Builder, `--load`, nativ) — kein `--builder`/Cache-Flag greift, keine Regression.
- **T4 (`PUSH=1`-Pfad ohne Prod-Risiko):** den Diff prüfen (`--builder`/`--cache-*` nur bei `PUSH=1`);
  **kein echter Prod-Push im Test** (überschriebe `:latest`). Der erste echte Release ist die finale
  Bestätigung (nächster Punkt).

## Verification (Erfolgskriterium)

1. Task-1-PoC grün = Kern-Mechanik bewiesen.
2. Beim **ersten echten `release`** durch den User: erster Lauf füllt `.buildcache/` (einmalig ~5 min);
   **jeder folgende** Release zeigt im Log `CACHED` bei `pnpm install`/`next build` und dauert **~1 min
   statt 5** — auch nachdem zwischendurch andere Projekte gebaut wurden. Das ist der eigentliche Beweis
   (Immunität gegen Eviction im Alltag).
3. Deploy-Vertrag intakt: gleiche Tags auf Docker Hub, `deploy.sh`/`compose.yml` unverändert.

## Alternativen (erwogen, verworfen)

- **Registry-Cache** (`type=registry`): kein lokaler Speicher, aber der Cache-Push bei **30–32 Mbit/s**
  Upload macht jeden Release langsamer → verworfen. (local = kein Netzwerk.)
- **BuildKit-GC `keepStorage` erhöhen** (daemon.json): bei dem Fremd-Müll-Volumen wird die Schwelle
  immer wieder gesprengt → unzuverlässig. 0-Aufwand-Ergänzung, aber kein Verlass → nicht der Kern.
- **Disk-Limit erhöhen** (Docker Desktop): lindert den Druck, löst die LRU-Konkurrenz nicht → ergänzend.
- **Einmaliges Aufräumen** (`docker image prune`, alte Fremd-Images): User-Aktion, destruktiv, nicht Teil
  des Code-Plans; sofort empfohlen als Sofortentlastung.

## Nachgelagert (nicht dieser Plan)
- **Hebel C** (nur geänderte App bauen/pushen) — halbiert den warmen Release zusätzlich; eigener Plan.

## Self-review
- Requirements ↔ Tasks: persistenter Cache → T1+T2; gitignore/Doku → T3; Verifikation → T4/Verification.
- Namen konsistent: `vereinsheim-cache`, `.buildcache/<app>-<target>`, `BUILDER`, `cache_args`, `cache_dir`.
- `cache_dir` nutzt `$target` → muss in der `for`-Schleife stehen (im Plan vermerkt), nicht davor.
- Keine Platzhalter: alle Befehle konkret. Prod-Push-Risiko bei T4 explizit vermieden.
- PoC-first verankert (Lehre aus A+B): kein Skript-Umbau vor bewiesener Mechanik.
