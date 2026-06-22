# App-Konsistenz: Drift-Schutz Ringwerk × Treffsicher

Ringwerk und Treffsicher teilen sich bewusst eine UI-/Pattern-Schicht (gleicher Stack, gleiches
Design-System). Seit der Monorepo-Migration liegen beide als `apps/ringwerk` / `apps/treffsicher` in
**einem** Repo — die Schicht ist aber **noch kopiert, nicht geteilt** (echtes Teilen via `packages/ui`
ist Phase 4, siehe [`monorepo-plan.md`](monorepo-plan.md)). Bis dahin schützen die folgenden Mechanismen
vor Drift.

## Tier 2 — Drift-Gate (aktiv)

`scripts/consistency-check.sh` vergleicht die beiden Apps (`apps/ringwerk`, `apps/treffsicher`):

- **Fatal (Exit 1):** byte-identische Shared-Dateien, Config-Dateien und gemeinsame `ui/`-Komponenten
  weichen ab.
- **Warnung:** Dependency-Versionsdrift (durch den pnpm-Catalog praktisch ausgeschlossen); bekannte
  Anti-Pattern (native Dialoge, `MoreHorizontal` in Aktionen, `font-bold`-h1, ASCII-Ellipsis, inline
  `Intl.DateTimeFormat`).

Eingehängt in `scripts/build-and-push.sh` (Release-Pfad, `PUSH=1`) → **Drift kann nicht released
werden**. Manuell: `./scripts/consistency-check.sh` (Default-Pfade sind bereits `apps/*`).

Die maßgebliche Liste der Shared-Dateien und Patterns steht in `apps/*/docs/shared-conventions.md` (in
beiden Apps byte-identisch, vom Gate erzwungen).

## Tier 3 — Konventionen-Kanon (aktiv)

`apps/*/docs/shared-conventions.md` ist die lebende Quelle der app-übergreifenden Konventionen:
Shared-Datei-Liste, Komponenten-/Pattern-Kanon, Icon-Vokabular, Typografie, Navigation, Formatierung. Aus
beiden `CLAUDE.md` verlinkt.

## Tier 1 — Geteiltes Paket (Phase 4)

Die dauerhafte Lösung: die Shared-Schicht in **eine Quelle** (`packages/ui` + `packages/lib`) ziehen, die
beide Apps via `@vereinsheim/ui` konsumieren — dann ist Byte-Drift per Konstruktion unmöglich und das
Gate für diese Dateien entfällt. Das ist **Phase 4** der Monorepo-Migration (ADR-015); die
Monorepo-Struktur (Phase 1) + der Build aus dem Monorepo (Phase 3) stehen bereits. Bis Phase 4 halten
Tier 2 + Tier 3 die Konsistenz.

> Historisch nannte dieses Dokument drei Optionen (Monorepo / git subtree / privates npm-Paket). Die
> Entscheidung ist gefallen: **Monorepo** (ADR-015), git subtree wurde explizit verworfen.

## Offene Angleichungen (Baseline-Reste)

- **Dependency-Pins:** ✅ durch den pnpm-Catalog gelöst — eine Version zentral in `pnpm-workspace.yaml`,
  beide Apps referenzieren `catalog:`.
- **ActionResult-Typ:** Treffsicher-Module auf Ringwerks diskriminierte Union migrieren (invasiv) — passt
  in `packages/lib` (Phase 4).
- **Doku-/Instruktions-Struktur:** Treffsicher nutzt Root-`CLAUDE.md` + `docs/`, Ringwerk
  `.claude/CLAUDE.md` + `.claude/docs/` — Vereinheitlichung in der CLAUDE.md-Hierarchie (Phase 2).
