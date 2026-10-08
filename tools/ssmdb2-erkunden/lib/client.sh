# shellcheck shell=bash
# Verbindung zur SSMDB2: Client finden, Zugangsdatei, Abfragen. Nur lesen (ADR-027).
# Kompatibel mit macOS-Bash 3.2: keine assoziativen Arrays, keine leeren Arrays unter `set -u`.

CLIENT_MODUS=""                        # lokal | docker
MYSQL_BIN=""
DUMP_BIN=""
DOCKER_IMAGE="${ERKUNDEN_DOCKER_IMAGE:-mariadb:11}"
DOCKER_CLIENT="ssmdb2-erkunden-client-$$"
DOCKER_NETZ=""                         # nur für den Selbsttest
ZUGANG_DIR=""
RO_INIT="SET SESSION TRANSACTION READ ONLY"

# Sucht einen MySQL-Client. $1 = 1 erzwingt Docker. Rückgabe 1, wenn keiner da ist.
client_finden() {
  local b
  if [ "${1:-0}" != 1 ]; then
    for b in mariadb mysql; do
      if command -v "$b" >/dev/null 2>&1; then MYSQL_BIN=$b; break; fi
    done
    for b in mariadb-dump mysqldump; do
      if command -v "$b" >/dev/null 2>&1; then DUMP_BIN=$b; break; fi
    done
    if [ -n "$MYSQL_BIN" ] && [ -n "$DUMP_BIN" ]; then
      CLIENT_MODUS=lokal
      return 0
    fi
  fi
  if command -v docker >/dev/null 2>&1 && docker image inspect "$DOCKER_IMAGE" >/dev/null 2>&1; then
    CLIENT_MODUS=docker
    MYSQL_BIN=mariadb
    DUMP_BIN=mariadb-dump
    return 0
  fi
  return 1
}

client_beschreibung() {
  if [ "$CLIENT_MODUS" = docker ]; then
    printf 'Docker-Image %s (%s, %s)\n' "$DOCKER_IMAGE" "$MYSQL_BIN" "$DUMP_BIN"
  else
    printf 'lokal: %s, %s\n' "$(command -v "$MYSQL_BIN")" "$(command -v "$DUMP_BIN")"
  fi
}

_cnf_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

# Schreibt die Zugangsdaten in eine temporäre Datei (Rechte 600), nie auf die Kommandozeile.
# $1 host  $2 port  $3 user  $4 passwort
zugang_schreiben() {
  ZUGANG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/ssmdb2-zugang.XXXXXX")
  chmod 700 "$ZUGANG_DIR"
  (
    umask 077
    {
      echo "[client]"
      echo "host=$1"
      echo "port=$2"
      echo "user=\"$(_cnf_escape "$3")\""
      echo "password=\"$(_cnf_escape "$4")\""
    } >"$ZUGANG_DIR/zugang.cnf"
  )
}

# Startet im Docker-Fall einen Client-Container, in den jede Abfrage per `docker exec -i` geht.
client_starten() {
  [ "$CLIENT_MODUS" = docker ] || return 0
  local netz=""
  if [ -n "$DOCKER_NETZ" ]; then netz="--network=$DOCKER_NETZ"; fi
  # shellcheck disable=SC2086  # $netz ist leer oder genau ein Argument
  docker run -d --rm --name "$DOCKER_CLIENT" $netz -v "$ZUGANG_DIR:/zugang:ro" \
    --entrypoint sleep "$DOCKER_IMAGE" infinity >/dev/null
}

client_aufraeumen() {
  if [ "$CLIENT_MODUS" = docker ]; then
    docker rm -f "$DOCKER_CLIENT" >/dev/null 2>&1 || true
  fi
  if [ -n "$ZUGANG_DIR" ]; then rm -rf "$ZUGANG_DIR"; fi
}

_cnf_pfad() {
  if [ "$CLIENT_MODUS" = docker ]; then echo /zugang/zugang.cnf; else echo "$ZUGANG_DIR/zugang.cnf"; fi
}

# Führt den Client mit Zugangsdatei aus; stdin wird durchgereicht.
_client() {
  local bin=$1
  shift
  if [ "$CLIENT_MODUS" = docker ]; then
    docker exec -i "$DOCKER_CLIENT" "$bin" --defaults-extra-file="$(_cnf_pfad)" "$@"
  else
    "$bin" --defaults-extra-file="$(_cnf_pfad)" "$@"
  fi
}

_mysql() {
  if [ -n "$RO_INIT" ]; then
    _client "$MYSQL_BIN" --connect-timeout=5 --init-command="$RO_INIT" --database="$DB" "$@"
  else
    _client "$MYSQL_BIN" --connect-timeout=5 --database="$DB" "$@"
  fi
}

# Eine Abfrage, Ergebnis tab-getrennt mit Kopfzeile (NULL wörtlich, Sonderzeichen escapet).
sql_text() {
  _mysql --batch -e "$1"
}

# Wie sql_text, aber als lesbare Tabelle mit der Abfrage davor (für den Bericht).
sql_tabelle() {
  _mysql --table -vvv -e "$1" | sed '/^Bye$/d'
}

# Eine SQL-Datei als lesbare Tabellen, jede Abfrage mit ihrem Text (für den Bericht). Scheitert eine
# Abfrage (etwa weil das echte Schema anders aussieht), laufen die übrigen weiter (--force).
sql_datei_tabelle() {
  _mysql --table -vvv --force <"$1" 2>&1 | sed '/^Bye$/d'
}

# Dump über den passenden Dump-Client; Argumente werden angehängt, Ausgabe auf stdout.
sql_dump() {
  _client "$DUMP_BIN" "$@" "$DB"
}

# Zeit des Macs in Millisekunden.
jetzt_ms() {
  perl -MTime::HiRes=time -e 'printf "%d\n", time * 1000'
}
