#!/usr/bin/env bash
# consistency-check.sh — verhindert Drift zwischen Ringwerk, Treffsicher und Spiegel.
#
# FATAL (Exit 1):
#   - die app-lokalen Shared-Dateien weichen zwischen den Apps ab
#   - Verstöße gegen die Regeln von Design 2 (ADR-030/032, vault/conventions.md §2/§3/§4/§6/§7/§10) in den Apps
#     und in den geteilten UI-Paketen
# WARN (nicht blockierend):
#   - gemeinsame Dependencies haben unterschiedliche Versionen
#   - native Dialoge, MoreHorizontal in Detail-Aktionen
#
# Die Apps kommen aus scripts/lib/apps.sh. Alle drei laufen auf Design 2 und prüfen dieselben Regeln.
#
# Aufruf: ./scripts/consistency-check.sh   (vor jedem Release via build-and-push.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=lib/apps.sh
. scripts/lib/apps.sh

fail=0
warn=0

# Geteilte Dateien, die in ALLEN Apps byte-identisch sein MÜSSEN.
# Fast die gesamte geteilte Schicht liegt in packages/*: tsconfig/eslint/
# prettier/postcss/next.config/vitest in @vereinsheim/config; cn/forms/fieldErrors +
# Form-Hooks in @vereinsheim/lib; die ui/-Primitives, shell/-Komponenten, design2/-Bausteine
# und die Tokens (@vereinsheim/ui/design2.css) in @vereinsheim/ui — Drift dort strukturell
# unmöglich. Hier bleibt nur, was Next/shadcn als app-lokale Dateien erzwingen (alle trivial +
# byte-identisch): components.json, der dünne globals.css-Stub, die Error-Boundaries + not-found.
MUST_MATCH=(
  components.json
  src/app/globals.css
  src/app/error.tsx
  "src/app/(app)/error.tsx"
  src/app/not-found.tsx
)
# Der Wrapper um die geteilte Rate-Limit-Oberfläche (app-lokal, weil eine geteilte Datei keine
# Server Action re-exportieren darf) liegt in Spiegel unter einem anderen Pfad.
rate_limit_wrapper() {
  case "$1" in
    spiegel) echo "apps/spiegel/src/components/admin/AdminLoginRateLimitTable.tsx" ;;
    *) echo "apps/$1/src/components/app/admin/AdminLoginRateLimitTable.tsx" ;;
  esac
}
# Hinweis: vault/conventions.md ist EINE Quelle am Root, nicht pro App.

ref="${APPS[0]}"

# same_file <label> <pfad der Referenz-App> <pfad der App>
same_file() {
  if [[ ! -f "$2" || ! -f "$3" ]]; then
    echo "  FATAL fehlt: $1 (${2} oder ${3})"
    fail=1
  elif ! diff -q "$2" "$3" >/dev/null; then
    echo "  DIFF $1: $2 vs $3"
    fail=1
  fi
}

echo "== Byte-identische Shared-Dateien (${APPS[*]}) =="
before=$fail
for app in "${APPS[@]:1}"; do
  for f in "${MUST_MATCH[@]}"; do
    same_file "$f" "apps/$ref/$f" "apps/$app/$f"
  done
  same_file "AdminLoginRateLimitTable.tsx" "$(rate_limit_wrapper "$ref")" "$(rate_limit_wrapper "$app")"
done
[[ "$fail" == "$before" ]] && echo "  ok   ${#MUST_MATCH[@]} Dateien + Rate-Limit-Wrapper"

echo "== Gemeinsame Dependency-Versionen =="
pkgs=()
for app in "${APPS[@]}"; do pkgs+=("apps/$app/package.json"); done
dep_report=$(python3 - "${pkgs[@]}" <<'PY'
import json, os, sys
apps = {}
for p in sys.argv[1:]:
    d = json.load(open(p))
    apps[os.path.basename(os.path.dirname(p))] = {**d.get("dependencies", {}), **d.get("devDependencies", {})}
names = sorted(set().union(*apps.values()))
drift = 0
for k in names:
    vals = {a: deps[k] for a, deps in apps.items() if k in deps}
    if len(vals) > 1 and len(set(vals.values())) > 1:
        drift += 1
        print(f"  DRIFT {k}: " + ", ".join(f"{a} {v}" for a, v in vals.items()))
print(f"__COUNT__ {drift}")
PY
)
# Dependency-Drift ist WARN (nicht fatal): die Versionen kommen aus dem pnpm-Catalog, Abweichungen
# sind bewusst und selten.
echo "$dep_report" | grep -v '__COUNT__' || true
if [[ "$(echo "$dep_report" | sed -n 's/^__COUNT__ //p')" != "0" ]]; then
  warn=1
fi

echo "== Konventionen von Design 2 (fatal) =="
# Diese Regeln stehen in vault/conventions.md §2/§3/§4/§6/§7/§10 und werden im Code
# eingehalten. Ohne Gate driften sie zurueck — deshalb fatal.
#
# Wichtig bei den Mustern: eng genug halten, damit legitime Faelle nicht
# anschlagen. Ein "→" steht auch als Inhalt in Protokolltexten ("alt → neu").
#
# Geprueft werden die Apps und die geteilten Pakete, aus denen ihre Oberflaeche besteht. Die
# shadcn-Primitives in packages/ui/src/ui und Ringwerks checkbox bringen ihre dark:-Varianten aus
# dem Generator mit; Tests duerfen die verbotenen Muster als Erwartung enthalten.
conv_fail=0
report() { echo "  FATAL $1: $2"; conv_fail=1; fail=1; }

targets=()
for app in "${APPS[@]}"; do targets+=("apps/$app/src"); done
targets+=(packages/ui/src packages/shot-ui/src packages/shot-help/src)

# hits <dir> <grep-Optionen…> <muster>: Treffer ohne Tests (Optionen vor dem Muster, auch unter POSIXLY_CORRECT)
hits() {
  local dir="$1"
  shift
  { grep -rn "$@" "$dir" 2>/dev/null || true; } | { grep -vE '\.test\.tsx?:' || true; } | wc -l | tr -d ' '
}

for dir in "${targets[@]}"; do
  name="${dir%/src}"

  # §4: Farbe traegt Bedeutung ueber Tokens, nicht ueber die Tailwind-Palette.
  n=$(hits "$dir" --include='*.tsx' --include='*.ts' -E '\b(text|bg|border|ring|fill|stroke)-(emerald|amber|yellow|orange|sky|blue|green|red|rose|slate|zinc|gray|purple)-[0-9]')
  [[ "$n" != "0" ]] && report "$name" "$n Palette-Klasse(n) statt semantischem Token (§4)"

  # §4: Farbe kommt aus den Tokens, die hell und dunkel je ihren Wert haben; dark:-Varianten
  # umgehen sie.
  n=$({ grep -rn --include='*.tsx' 'dark:' "$dir" 2>/dev/null || true; } \
    | { grep -vE '\.test\.tsx:|packages/ui/src/ui/|apps/ringwerk/src/components/ui/checkbox\.tsx' || true; } | wc -l | tr -d ' ')
  [[ "$n" != "0" ]] && report "$name" "$n dark:-Variante(n) — Farbe aus den Tokens (§4)"

  # §3: Kontrast-Untergrenze.
  n=$(hits "$dir" -E 'text-muted-foreground/[0-9]+')
  [[ "$n" != "0" ]] && report "$name" "$n Opazitaets-Modifier auf text-muted-foreground (§3)"

  # §6: Formatierung nur ueber @vereinsheim/lib/format.
  n=$(hits "$dir" --include='*.ts' --include='*.tsx' 'new Intl\.')
  [[ "$n" != "0" ]] && report "$name" "$n inline new Intl.* — @vereinsheim/lib/format nutzen (§6)"
  n=$(hits "$dir" -E '\.toLocale(Date|Time)?String\(')
  [[ "$n" != "0" ]] && report "$name" "$n toLocale*String() — formatiert in der Locale des Browsers (§6)"

  # §3: Unicode-Ellipse in Pending-Texten.
  n=$(hits "$dir" -E '(Speichern|Löschen|Laden|Lädt|Wird|Anmelden|Generiere|Erstelle)\.\.\.')
  [[ "$n" != "0" ]] && report "$name" "$n ASCII-'...' statt '…' (§3)"

  # §7: Die Karte bzw. ihr Titel ist der Link — kein zusaetzlicher "Details →".
  n=$(hits "$dir" --include='*.tsx' -E '>[^<]*(Details|Rangliste|Mehr)\s*→')
  [[ "$n" != "0" ]] && report "$name" "$n '… →'-Button statt klickbarer Karte (§7)"

  # §10: Symbolknoepfe sind mindestens 24 px gross (size="icon-xs"). Gesucht wird im ganzen
  # oeffnenden <Button …>-Tag, auch ueber mehrere Zeilen und ueber {…}-Ausdruecke mit ">" hinweg, nach
  # einer Klasse size-/h-/w- unter 6 (auch halbe Stufen, px und [Npx] unter 24 px). Rohe <button>
  # sieht die Regel nicht.
  n=$(find "$dir" -name '*.tsx' ! -name '*.test.tsx' -print0 2>/dev/null | xargs -0 perl -0777 -ne '
    while (/<Button\b((?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^>{"])*)>/gs) {
      my $tag = $1;
      next unless $tag =~ /\bsize=(?:\{\s*)?["'\''`]icon/;
      $n++ if $tag =~ /(?:^|[\s"'\''`{])(?:size|h|w)-(?:[0-5](?:\.5)?|px|\[(?:1?\d|2[0-3])px\])(?=[\s"'\''`}]|$)/;
    }
    END { print $n // 0 }' 2>/dev/null | awk '{s+=$1} END {print s+0}')
  [[ "$n" != "0" ]] && report "$name" "$n Symbolknopf/-knoepfe unter 24 px (§10)"

  # §2: Reiter sind TabBar (eine Zeile, die wischt). Eine Reiterleiste von Hand erkennt man am Stil der gezeigten
  # Seite mit Flaeche; ihn setzen nur TabBar und der Rahmen der App.
  n=$({ grep -rn --include='*.tsx' -E 'aria-\[current=page\]:bg-' "$dir" 2>/dev/null || true; } \
    | { grep -vE '\.test\.tsx:|packages/ui/src/design2/(tab-bar|app-frame)\.tsx:' || true; } | wc -l | tr -d ' ')
  [[ "$n" != "0" ]] && report "$name" "$n Reiterleiste(n) von Hand — TabBar aus @vereinsheim/ui/design2/tab-bar (§2)"
done

if [[ "$conv_fail" == "0" ]]; then
  echo "  ok   alle Konventions-Checks (§2/§3/§4/§6/§7/§10) in ${#targets[@]} Verzeichnissen"
fi

echo "== Anti-Pattern (Warnungen) =="
for app in "${APPS[@]}"; do
  repo="apps/$app"
  n=$(hits "$repo/src" -E "window\.(alert|confirm|prompt)\(")
  if [[ "$n" != "0" ]]; then echo "  WARN $app: $n native Dialoge (window.alert/confirm/prompt)"; warn=1; fi
  mh=$({ grep -rl "MoreHorizontal" "$repo/src/components" 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [[ "$mh" != "0" ]]; then echo "  WARN $app: MoreHorizontal in $mh Datei(en) — Detail-Aktionen sollen Inline-ghost sein"; warn=1; fi
done

echo
if [[ "$fail" != "0" ]]; then
  echo "RESULT: FAIL — Drift in geteilten Dateien oder Verstoß gegen die Konventionen. Bitte angleichen, bevor released wird."
  exit 1
fi
if [[ "$warn" != "0" ]]; then
  echo "RESULT: OK mit Warnungen (nicht blockierend)."
else
  echo "RESULT: OK — keine Drift erkannt."
fi
exit 0
