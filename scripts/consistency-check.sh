#!/usr/bin/env bash
# consistency-check.sh — verhindert Drift zwischen Ringwerk und Treffsicher.
#
# FATAL (Exit 1):
#   - byte-identische Shared-Dateien weichen ab
#   - Config-Dateien weichen ab
#   - gemeinsame ui/-Komponenten weichen ab
#   - gemeinsame Dependencies haben unterschiedliche Versionen
# WARN (nicht blockierend):
#   - bekannte Anti-Pattern (native Dialoge, MoreHorizontal in Aktionen,
#     font-bold-h1, ASCII-Ellipsis, inline Intl-Datum)
#
# Aufruf: ./scripts/consistency-check.sh   (vor jedem Release via build-and-push.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

# Monorepo: vergleicht standardmäßig die beiden apps/* (früher die Standalone-Repos).
# Wird in Phase 4 (packages/ui) überflüssig — dann teilen sich die Apps die Dateien.
RW="${RINGWERK_PATH:-apps/ringwerk}"
TS="${TREFFSICHER_PATH:-apps/treffsicher}"

fail=0
warn=0

# Geteilte Dateien, die in BEIDEN Repos byte-identisch sein MÜSSEN.
# Fast die gesamte geteilte Schicht liegt inzwischen in packages/*: tsconfig/eslint/
# prettier/postcss/next.config in @vereinsheim/config (Phase 2); cn/forms/fieldErrors +
# Form-Hooks in @vereinsheim/lib (Zyklus 1); die ui/-Primitives, shell/-Komponenten und
# der globals.css-Theme-Kern (@vereinsheim/ui/theme.css) in @vereinsheim/ui (Zyklus 2) —
# Drift dort strukturell unmöglich. Hier bleibt nur, was Next/shadcn als app-lokale Dateien
# erzwingen (alle trivial + byte-identisch): components.json, der dünne globals.css-Stub,
# die Error-Boundaries + not-found.
MUST_MATCH=(
  components.json
  src/app/globals.css
  src/app/error.tsx
  "src/app/(app)/error.tsx"
  src/app/not-found.tsx
)
# Hinweis: docs/shared-conventions.md ist seit der Harness-Konsolidierung EINE
# Quelle am Root (docs/shared-conventions.md) — nicht mehr pro App dupliziert.

echo "== Byte-identische Shared-Dateien & Configs =="
for f in "${MUST_MATCH[@]}"; do
  if [[ ! -f "$TS/$f" || ! -f "$RW/$f" ]]; then
    echo "  FATAL fehlt in einem Repo: $f"
    fail=1
    continue
  fi
  if diff -q "$TS/$f" "$RW/$f" >/dev/null; then
    echo "  ok   $f"
  else
    echo "  DIFF $f"
    fail=1
  fi
done

# (Die frühere "Gemeinsame ui/-Komponenten"-Diff-Schleife entfällt mit Zyklus 2: die geteilten
# ui/shell-Komponenten liegen jetzt in @vereinsheim/ui; die verbleibenden src/components/ui/* sind
# bewusst app-spezifisch — chart/form/table (treffsicher), checkbox/rank-badge/skeleton (ringwerk) —
# und DÜRFEN abweichen.)

echo "== Gemeinsame Dependency-Versionen =="
dep_report=$(python3 - "$TS/package.json" "$RW/package.json" <<'PY'
import json, sys
def deps(p):
    d = json.load(open(p))
    return {**d.get("dependencies", {}), **d.get("devDependencies", {})}
t, r = deps(sys.argv[1]), deps(sys.argv[2])
drift = [(k, t[k], r[k]) for k in sorted(set(t) & set(r)) if t[k] != r[k]]
for k, a, b in drift:
    print(f"  DRIFT {k}: treffsicher {a} vs ringwerk {b}")
print(f"__COUNT__ {len(drift)}")
PY
)
# Dependency-Drift ist vorerst WARN (nicht fatal): die Pin-Angleichung (inkl.
# TypeScript-Major) ist als separater, vorsichtiger Schritt geplant. Nach der
# Angleichung kann dies auf fatal (fail=1) hochgestuft werden.
echo "$dep_report" | grep -v '__COUNT__' || true
if [[ "$(echo "$dep_report" | sed -n 's/^__COUNT__ //p')" != "0" ]]; then
  warn=1
fi

echo "== Anti-Pattern (Warnungen) =="
for repo in "$TS" "$RW"; do
  name=$(basename "$repo")
  hits=$(grep -rnE "window\.(alert|confirm|prompt)\(" "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  if [[ "$hits" != "0" ]]; then echo "  WARN $name: $hits native Dialoge (window.alert/confirm/prompt)"; warn=1; fi
  mh=$(grep -rl "MoreHorizontal" "$repo/src/components" 2>/dev/null | wc -l | tr -d ' ') || true
  if [[ "$mh" != "0" ]]; then echo "  WARN $name: MoreHorizontal in $mh Datei(en) — Detail-Aktionen sollen Inline-ghost sein"; warn=1; fi
  fb=$(grep -rl "text-2xl font-bold" "$repo/src/app" 2>/dev/null | wc -l | tr -d ' ') || true
  if [[ "$fb" != "0" ]]; then echo "  WARN $name: 'text-2xl font-bold' in $fb Datei(en) — Kanon ist font-semibold"; warn=1; fi
  el=$(grep -rnE "(Speichern|Löschen|Laden|Wird)\.\.\." "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  if [[ "$el" != "0" ]]; then echo "  WARN $name: $el ASCII-'...' in Pending-Texten — Unicode '…' nutzen"; warn=1; fi
  # Page-/Komponenten-Level inline Intl ist Anti-Pattern; dedizierte Formatter-Module
  # (PDF-Export, _lib) sind legitim und ausgenommen.
  intl=$(grep -rl "new Intl.DateTimeFormat" "$repo/src/app" 2>/dev/null | grep -vE "/(_lib|pdf|export)/" | wc -l | tr -d ' ') || true
  if [[ "$intl" != "0" ]]; then echo "  WARN $name: inline Intl.DateTimeFormat in $intl Datei(en) — lib/dateTime nutzen"; warn=1; fi
done

echo
if [[ "$fail" != "0" ]]; then
  echo "RESULT: FAIL — Drift in geteilten Dateien/Configs/Dependencies. Bitte angleichen, bevor released wird."
  exit 1
fi
if [[ "$warn" != "0" ]]; then
  echo "RESULT: OK mit Warnungen (nicht blockierend)."
else
  echo "RESULT: OK — keine Drift erkannt."
fi
exit 0
