#!/usr/bin/env bash
# SSMDB2 vor Ort erkunden (SP-0.1 + SP-0.6). Liest nur. Ablauf: tools/ssmdb2-erkunden/README.md.
#
#   erkunden.sh [Optionen] [Phase …]
#
# Phasen: selbsttest verbinden checkliste dump protokoll abschluss (ohne Angabe: alle, mit Rückfragen)
# Optionen:
#   --host HOST       Meyton-Server (Vorgabe 192.168.10.200)
#   --port PORT       (Vorgabe 3306)
#   --db NAME         (Vorgabe SSMDB2)
#   --user NAME       Benutzer (sonst Abfrage)
#   --ausgabe DIR     Ausgabeordner (Vorgabe ~/ssmdb2-erkundung/<Datum_Zeit>)
#   --docker          Docker-Client erzwingen, auch wenn ein lokaler da ist
#   --docker-netz N   Docker-Netz für den Client (nur Selbsttest)
#   --auto            ohne Rückfragen (nur Selbsttest; Passwort aus ERKUNDEN_PASSWORT)
set -euo pipefail

HIER=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib/client.sh
. "$HIER/lib/client.sh"

HOST=192.168.10.200
PORT=3306
DB=SSMDB2
BENUTZER="${ERKUNDEN_USER:-}"
AUSGABE=""
AUTO=0
DOCKER_ERZWINGEN=0
VERBUNDEN=0
ALLE_PHASEN="selbsttest verbinden"

info() { printf '\033[1m==>\033[0m %s\n' "$*" >&2; }
warnung() { printf '\033[33m!!\033[0m %s\n' "$*" >&2; }
fehler() {
  printf '\033[31mFehler:\033[0m %s\n' "$*" >&2
  exit 1
}

# Ja/Nein-Frage; im Auto-Modus immer ja.
frage_ja() {
  local antwort
  if [ "$AUTO" = 1 ]; then return 0; fi
  read -r -p "$1 [j/N] " antwort
  case "$antwort" in j | J | ja | Ja) return 0 ;; *) return 1 ;; esac
}

aufraeumen() {
  client_aufraeumen
}
trap aufraeumen EXIT

while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST=$2; shift 2 ;;
    --port) PORT=$2; shift 2 ;;
    --db) DB=$2; shift 2 ;;
    --user) BENUTZER=$2; shift 2 ;;
    --ausgabe) AUSGABE=$2; shift 2 ;;
    --docker) DOCKER_ERZWINGEN=1; shift ;;
    --docker-netz) DOCKER_NETZ=$2; shift 2 ;;
    --auto) AUTO=1; shift ;;
    -h | --help) sed -n '2,17p' "$0"; exit 0 ;;
    -*) fehler "unbekannte Option: $1" ;;
    *) break ;;
  esac
done
PHASEN="${*:-$ALLE_PHASEN}"

ausgabe_anlegen() {
  if [ -z "$AUSGABE" ]; then AUSGABE="$HOME/ssmdb2-erkundung/$(date +%Y-%m-%d_%H%M)"; fi
  mkdir -p "$AUSGABE/privat" "$AUSGABE/bericht"
  chmod 700 "$AUSGABE/privat"
}

# Markdown-Helfer für den Bericht.
md_code() {
  echo '```'
  cat
  echo '```'
}

# ---------------------------------------------------------------- Phase selbsttest

phase_selbsttest() {
  info "Selbsttest"
  local ok=1 werkzeug
  echo "Bash: $BASH_VERSION"
  if client_finden "$DOCKER_ERZWINGEN"; then
    echo "MySQL-Client: $(client_beschreibung)"
  else
    warnung "Kein MySQL-Client: weder mariadb/mysql lokal noch das Docker-Image $DOCKER_IMAGE."
    warnung "Zu Hause vorbereiten: docker pull $DOCKER_IMAGE (oder: brew install mariadb)."
    ok=0
  fi
  for werkzeug in perl awk gzip curl; do
    if command -v "$werkzeug" >/dev/null 2>&1; then
      echo "$werkzeug: ok"
    else
      warnung "$werkzeug fehlt"
      ok=0
    fi
  done
  [ "$ok" = 1 ] || fehler "Selbsttest nicht bestanden"
  info "Selbsttest bestanden"
}

# ---------------------------------------------------------------- Phase verbinden

zugang_abfragen() {
  local passwort="${ERKUNDEN_PASSWORT:-}"
  if [ -z "$BENUTZER" ]; then
    [ "$AUTO" = 0 ] || fehler "--auto braucht ERKUNDEN_USER oder --user"
    read -r -p "Benutzer (Standard-Zugang laut Meyton-Handbuch): " BENUTZER
  fi
  if [ -z "$passwort" ]; then
    [ "$AUTO" = 0 ] || fehler "--auto braucht ERKUNDEN_PASSWORT"
    read -r -s -p "Passwort: " passwort
    echo >&2
  fi
  zugang_schreiben "$HOST" "$PORT" "$BENUTZER" "$passwort"
}

# Stellt die Verbindung einmal pro Aufruf her (Zugang abfragen, Client starten, Nur-Lesen prüfen).
verbindung_sicherstellen() {
  local fehlertext
  [ "$VERBUNDEN" = 0 ] || return 0
  client_finden "$DOCKER_ERZWINGEN" || fehler "kein MySQL-Client (erst: erkunden.sh selbsttest)"
  ausgabe_anlegen
  zugang_abfragen
  client_starten
  info "Verbinde mit $HOST:$PORT/$DB"
  if ! fehlertext=$(sql_text "SELECT 1" 2>&1 >/dev/null); then
    if printf '%s' "$fehlertext" | grep -qi "syntax"; then
      warnung "Der Server kennt 'SET SESSION TRANSACTION READ ONLY' nicht."
      warnung "Das Skript sendet trotzdem nur SELECT, SHOW und EXPLAIN."
      frage_ja "Ohne Read-only-Sitzung weitermachen?" || fehler "abgebrochen"
      RO_INIT=""
      sql_text "SELECT 1" >/dev/null || fehler "Verbindung fehlgeschlagen"
    else
      fehler "Verbindung fehlgeschlagen: $fehlertext"
    fi
  fi
  VERBUNDEN=1
}

# Liest eine Systemvariable, die je nach Server anders heißt; leer, wenn keine passt.
variable_lesen() {
  local name
  for name in "$@"; do
    if sql_text "SELECT @@$name AS wert" 2>/dev/null | sed -n 2p; then return 0; fi
  done
}

phase_verbinden() {
  verbindung_sicherstellen
  local datei="$AUSGABE/bericht/umgebung.md" vorher nachher anlage_ms
  info "Umgebung festhalten: $datei"
  vorher=$(jetzt_ms)
  anlage_ms=$(sql_text "SELECT ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000) AS ms" | sed -n 2p)
  nachher=$(jetzt_ms)
  {
    echo "# Umgebung"
    echo
    echo "- Erkundet: $(date '+%Y-%m-%d %H:%M:%S %z') (Mac)"
    echo "- Server: $HOST:$PORT, Datenbank $DB"
    echo "- Client: $(client_beschreibung)"
    if [ -n "$RO_INIT" ]; then
      echo "- Sitzung: read-only ($RO_INIT)"
    else
      echo "- Sitzung: ohne Read-only (Server kennt es nicht), nur SELECT/SHOW/EXPLAIN gesendet"
    fi
    echo "- Read-only laut Server: $(variable_lesen session.transaction_read_only session.tx_read_only)"
    echo
    echo "## Server und Uhr"
    echo
    sql_tabelle "SELECT VERSION() AS version, @@version_comment AS art, NOW(3) AS jetzt_anlage,
      UTC_TIMESTAMP(3) AS utc_anlage, @@session.time_zone AS sitzung_tz,
      @@global.time_zone AS global_tz, @@system_time_zone AS system_tz" | md_code
    echo
    echo "Uhr der Anlage minus Uhr des Macs: $((anlage_ms - (vorher + nachher) / 2)) ms" \
      "(Abfrage dauerte $((nachher - vorher)) ms; SF-29)."
    echo
    echo "## Zeichensatz"
    echo
    sql_tabelle "SHOW VARIABLES WHERE Variable_name LIKE 'character_set%' OR Variable_name LIKE 'collation%'" | md_code
    echo
    echo "## Tabelle Version"
    echo
    sql_tabelle "SELECT * FROM Version" 2>&1 | md_code
    echo
    echo "## Netz (SF-57)"
    echo
    netz_pruefen | md_code
  } >"$datei"
}

netz_pruefen() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://example.com || true)
  echo "Internet vom Mac aus (https://example.com): HTTP ${code:-keine Antwort}"
  echo "Standard-Route: $(route -n get default 2>/dev/null | awk '/gateway|interface/ {printf "%s ", $0}' || true)"
  if command -v smbutil >/dev/null 2>&1; then
    echo "Freigaben auf $HOST (smbutil view, Gast):"
    smbutil view -G "//$HOST" 2>&1 | sed 's/^/  /' || true
  else
    echo "smbutil nicht vorhanden; Freigaben nicht geprüft"
  fi
}

# ---------------------------------------------------------------- Ablauf

for phase in $PHASEN; do
  case "$phase" in
    selbsttest) phase_selbsttest ;;
    verbinden) phase_verbinden ;;
    *) fehler "unbekannte Phase: $phase (bekannt: $ALLE_PHASEN)" ;;
  esac
done
if [ -n "$AUSGABE" ]; then info "Ausgabe: $AUSGABE"; fi
