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
# die Error-Boundaries + not-found. Dazu seit September 2026 der Wrapper um die geteilte
# Rate-Limit-Oberfläche (app-lokal, weil eine geteilte Datei keine Server Action
# re-exportieren darf) und der Vitest-Stub für `server-only`.
MUST_MATCH=(
  components.json
  src/app/globals.css
  src/app/error.tsx
  "src/app/(app)/error.tsx"
  src/app/not-found.tsx
  src/components/app/admin/AdminLoginRateLimitTable.tsx
  test/server-only-stub.ts
)
# Hinweis: vault/conventions.md ist seit der Harness-Konsolidierung EINE
# Quelle am Root (vault/conventions.md) — nicht mehr pro App dupliziert.

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
# ui/shell-Komponenten liegen jetzt in @vereinsheim/ui — seit September 2026 auch table +
# skeleton sowie die admin/-Rate-Limit-Oberfläche. Die verbleibenden src/components/ui/* sind
# bewusst app-spezifisch — chart/form (treffsicher), checkbox/rank-badge (ringwerk) —
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

echo "== Konventionen (fatal) =="
# Diese Regeln stehen in vault/conventions.md §3/§4/§6 und werden seit September
# 2026 im Code eingehalten. Ohne Gate driften sie zurueck — deshalb fatal.
#
# Wichtig bei den Mustern: eng genug halten, damit legitime Faelle nicht
# anschlagen. Beim Aufsetzen dieser Checks waren genau drei Fehlalarme zu
# vermeiden (jeweils real im Code): das EmptyState-Icon ist `h-8 w-8` und kein
# Button; ein "→" steht auch als Inhalt in Protokolltexten ("alt → neu"); und
# die Hex-Skala der Trefferlage-Charts ist eine Datenskala, keine UI-Semantik.
conv_fail=0
report() { echo "  FATAL $1: $2"; conv_fail=1; fail=1; }

for repo in "$TS" "$RW"; do
  name=$(basename "$repo")

  # §4: Farbe traegt Bedeutung ueber Tokens, nicht ueber die Tailwind-Palette.
  # Ausgenommen: PDF-Renderer (eigene Hex-Styles), die Trefferlage-Datenskala
  # und die shadcn-Chart-Generik.
  hits=$(grep -rnE '\b(text|bg|border|ring|fill|stroke)-(emerald|amber|yellow|orange|sky|blue|green|red|rose|slate|zinc|gray|purple)-[0-9]' \
    "$repo/src" --include='*.tsx' --include='*.ts' 2>/dev/null \
    | grep -vE '/pdf/|statistics-charts/constants\.ts|components/ui/chart\.tsx' | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits Palette-Klasse(n) statt semantischem Token (§4)"

  # §4: dark:-Varianten sind toter Code (beide Apps laufen fest im Dark Mode).
  hits=$(grep -rn 'dark:' "$repo/src" --include='*.tsx' 2>/dev/null \
    | grep -vE 'components/ui/(chart|checkbox|form|table)\.tsx' | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits dark:-Variante(n) — die Apps sind dark-only (§4)"

  # §3: Kontrast-Untergrenze.
  hits=$(grep -rnE 'text-muted-foreground/[0-9]+' "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits Opazitaets-Modifier auf text-muted-foreground (§3)"
  hits=$(grep -rnE 'text-\[[0-9]{1,2}px\]' "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits Schriftgroesse unter text-xs (§3)"

  # §3: Das Layout liefert den Container; eine Seite setzt keinen eigenen.
  hits=$(grep -rlE 'px-4 py-8' "$repo/src/app" --include='page.tsx' 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits Seite(n) mit eigenem px-/py-Container (§3)"

  # §6: Formatierung nur ueber @vereinsheim/lib/format.
  hits=$(grep -rn 'new Intl\.' "$repo/src" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits inline new Intl.* — @vereinsheim/lib/format nutzen (§6)"
  hits=$(grep -rnE '\.toLocale(Date|Time)?String\(' "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits toLocale*String() — formatiert in der Locale des Browsers (§6)"

  # §3: Unicode-Ellipse in Pending-Texten.
  hits=$(grep -rnE '(Speichern|Löschen|Laden|Lädt|Wird|Anmelden|Generiere|Erstelle)\.\.\.' "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits ASCII-'...' statt '…' (§3)"

  # §3: Seitentitel sind font-semibold, nicht bold.
  hits=$(grep -rn 'text-2xl font-bold' "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits 'text-2xl font-bold' — Kanon ist font-semibold (§3)"

  # Compliance-Regel der App: Icon-Buttons mind. h-10 w-10. Nur Buttons pruefen —
  # `h-8 w-8` an einem Icon (z.B. im EmptyState) ist legitim.
  hits=$(grep -rn 'h-8 w-8' "$repo/src" --include='*.tsx' 2>/dev/null | grep -iE '<Button|button' | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits Icon-Button unter h-10 w-10"

  # §7: Die Karte bzw. ihr Titel ist der Link — kein zusaetzlicher "Details →".
  hits=$(grep -rnE '>[^<]*(Details|Rangliste|Mehr)\s*→' "$repo/src" --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits '… →'-Button statt klickbarer Karte (§7)"

  # §2: Leerzustaende ueber die gemeinsame Komponente. Ausgenommen sind
  # (a) EmptyState selbst und seine Props, (b) Dialoge/Formulare/Editoren — dort
  # ist eine Zeile richtig — und (c) Strings in Anfuehrungszeichen, weil das
  # PageHeader-Untertitel sind ("Noch keine Einheiten erfasst.") und kein
  # Leerzustand. Gesucht wird also blanker JSX-Text.
  hits=$(grep -rnE 'Keine .{0,40}(vorhanden|gefunden|erfasst)|Noch keine ' "$repo/src" --include='*.tsx' 2>/dev/null \
    | grep -vE 'EmptyState|title=|description=|emptyText|/pdf/|Dialog|Editor|-form/|Form\.tsx' \
    | grep -vE '"[^"]*(Keine |Noch keine )' | wc -l | tr -d ' ') || true
  [[ "$hits" != "0" ]] && report "$name" "$hits inline-Leerzustand statt <EmptyState> (§2)"
done

if [[ "$conv_fail" == "0" ]]; then
  echo "  ok   alle Konventions-Checks (§2/§3/§4/§6/§7)"
fi

echo "== Anti-Pattern (Warnungen) =="
for repo in "$TS" "$RW"; do
  name=$(basename "$repo")
  hits=$(grep -rnE "window\.(alert|confirm|prompt)\(" "$repo/src" 2>/dev/null | wc -l | tr -d ' ') || true
  if [[ "$hits" != "0" ]]; then echo "  WARN $name: $hits native Dialoge (window.alert/confirm/prompt)"; warn=1; fi
  mh=$(grep -rl "MoreHorizontal" "$repo/src/components" 2>/dev/null | wc -l | tr -d ' ') || true
  if [[ "$mh" != "0" ]]; then echo "  WARN $name: MoreHorizontal in $mh Datei(en) — Detail-Aktionen sollen Inline-ghost sein"; warn=1; fi
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
