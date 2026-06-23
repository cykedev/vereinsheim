# Review-Report — `feat/graph-projection` (Doku-Index, ADR-022)

> PIV-Schritt 4. Adversarialer Review via `code-reviewer`-Sub-Agent gegen `git diff main...HEAD`.
> Verdict: **solide & merge-fähig**; 1 MAJOR + 1 MINOR behoben, 1 MINOR bewusst aufgeschoben.

## Bestätigt solide (Sub-Agent, aktiv getestet)

- Determinismus/Idempotenz: zweifacher Build byte-identisch; ADRs sortiert gemergt, Quellen behalten
  Reihenfolge. Committeter Store == Rebuild (kein Hand-Edit-Drift).
- Slug-Konsistenz: Reader, Validator, ADR-Parser nutzen dieselbe `slugify`/`headingSlugs`; ADR-Slug-
  Roundtrip 0 Mismatches über 22 ADRs; Code-Fences/ATX-closed/Umlaute korrekt.
- Pointer-Validierung greift (toter Slug + fehlende Datei → Exit 1). ADR-Parser: 22/22, Status korrekt,
  `supersedes` nur aus Titel (ADR-020 „supersedet" korrekt NICHT erfasst). Dup/Dangling/leer geflaggt.
- Schreib-Mechanik-Doku widerspruchsfrei (surface-hook, consolidate-lessons §5, sync-graph, ADR-022) —
  keine zurückgebliebenen Hand-Edit-/Live-Write-Empfehlungen. Hook fail-open intakt.

## Behoben

**MAJOR — Duplikat-Slugs (Verrottungsschutz-Loch).** `headingSlugs` disambiguierte Mehrfach-Überschriften
nicht; der Validator prüfte nur Mengen-Existenz, `readFragment` lieferte immer das erste Vorkommen. Real
betroffen: `features.md#konfiguration` (4×), `code-conventions.md#server-actions` (2×). Ein bare-base-
Pointer galt als gültig, traf aber unkontrolliert den ersten Abschnitt.
→ **Fix** (`3cbfe5e`): `headingSlugs` hängt GitHub-artig `-1/-2/…` an Duplikate → jeder Abschnitt eindeutig
adressierbar, `doc.mjs` deterministisch. Die 3 real betroffenen Pointer verifiziert: `#konfiguration`
(phase-locking) = Liga-Konfiguration mit den Sperr-Regeln (erstes Vorkommen, korrekt); `#server-actions`
(ringwerk/treffsicher) = Haupt-Sektion (korrekt). Weitere Vorkommen jetzt als `konfiguration-2` etc. nutzbar.

**MINOR — irreführende Fehlermeldung bei leerem Slug.** `→ datei#` ergab „Pointer-Datei fehlt".
→ **Fix** (`3cbfe5e`): Pointer an `#` gesplittet; leerer Slug meldet jetzt „leerer Slug im Pointer".

## Bewusst aufgeschoben

**MINOR — `mcp__memory__`-Write-Tools in `.claude/settings.json`-Allowlist.** ADR-022 rät Live-Writes ab
(Quelle+Rebuild ist der Schreibpfad), die Tools bleiben aber allowlisted. Kein Bug — die Doku ist eindeutig,
und der MCP-Server wird weiter lesend gebraucht. Permission-Härtung (Tools entfernen/kommentieren) ist eine
eigenständige settings-Änderung, die hier nicht zum Merge gehört; als optionaler Folgeschritt notiert.

## Validierung nach Fix

Rebuild grün + idempotent (gleicher Hash); `#konfiguration-2` adressierbar; leerer Slug → Exit≠0; Store
byte-unverändert (Auflösungs-only-Fix); `pnpm check` 17/17 FULL TURBO grün. **Merge-frei.**
