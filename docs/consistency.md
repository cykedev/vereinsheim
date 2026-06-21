# App-Konsistenz: Drift-Schutz Ringwerk × Treffsicher

Ringwerk und Treffsicher teilen sich bewusst eine UI-/Pattern-Schicht (gleicher Stack, gleiches
Design-System). Diese Schicht ist aktuell **kopiert**, nicht geteilt — ohne Schutz driftet sie über
die Zeit auseinander. Dieses Dokument beschreibt die Schutzmechanismen.

## Tier 2 — Drift-Gate (aktiv)

`scripts/consistency-check.sh` vergleicht beide App-Repos (`../ringwerk`, `../treffsicher`):

- **Fatal (Exit 1):** byte-identische Shared-Dateien, Config-Dateien und gemeinsame `ui/`-Komponenten
  weichen ab.
- **Warnung:** Dependency-Versionsdrift; bekannte Anti-Pattern (native Dialoge, `MoreHorizontal` in
  Aktionen, `font-bold`-h1, ASCII-Ellipsis, inline `Intl.DateTimeFormat`).

Eingehängt in `scripts/build-and-push.sh` → **Drift kann nicht released werden**. Manuell:
`./scripts/consistency-check.sh`.

Die maßgebliche Liste der Shared-Dateien und Patterns steht in `docs/shared-conventions.md` (in beiden
App-Repos byte-identisch, vom Gate erzwungen).

## Tier 3 — Konventionen-Kanon (aktiv)

`docs/shared-conventions.md` (in beiden App-Repos) ist die lebende Quelle der app-übergreifenden
Konventionen: Shared-Datei-Liste, Komponenten-/Pattern-Kanon, Icon-Vokabular, Typografie, Navigation,
Formatierung. Aus beiden `CLAUDE.md` verlinkt.

## Tier 1 — Geteiltes Paket (geplant, noch nicht umgesetzt)

Die dauerhafte Lösung: die Shared-Schicht in **eine Quelle** ziehen, die beide Apps konsumieren —
dann ist Byte-Drift per Konstruktion unmöglich (kein Gate mehr nötig für diese Dateien).

Optionen:

1. **Monorepo mit Workspace** (`packages/shared` + `apps/ringwerk` + `apps/treffsicher`). Sauberste
   Lösung; `vereinsheim` behandelt beide ohnehin als Einheit. Größter Umbau (Repos zusammenführen,
   Build-/Deploy-Pfade anpassen).
2. **git subtree** eines `shared/`-Ordners in beide Repos. Mittlerer Aufwand, Repos bleiben getrennt;
   Sync via `git subtree pull/push`.
3. **Publiziertes privates npm-Paket.** Versionierungs-/Registry-Overhead; entkoppelt am stärksten.

**Empfehlung:** Monorepo (Option 1), wenn ein größeres Zeitfenster da ist; sonst git subtree
(Option 2) als Zwischenschritt. Bis dahin halten Tier 2 + Tier 3 die Konsistenz.

## Offene Angleichungen (Baseline-Reste)

- **ActionResult-Typ:** Treffsicher-Module auf Ringwerks diskriminierte Union migrieren (invasiv).
- **Dependency-Pins:** identisch pinnen, inkl. Entscheidung TypeScript-Major (`^5` vs `^6`). Danach
  Dependency-Check im Gate von Warnung auf fatal hochstufen.
- **Doku-/Instruktions-Struktur:** Treffsicher nutzt Root-`CLAUDE.md` + `docs/`, Ringwerk
  `.claude/CLAUDE.md` + `.claude/docs/`. Bewusst belassen oder später vereinheitlichen.
