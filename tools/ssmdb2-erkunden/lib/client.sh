# shellcheck shell=bash
# Verbindung zur SSMDB2: Client finden, Zugangsdatei, Abfragen. Nur lesen (ADR-027).
# Kompatibel mit macOS-Bash 3.2: keine assoziativen Arrays, keine leeren Arrays unter `set -u`.

CLIENT_MODUS=""                        # lokal | docker
# shellcheck disable=SC2034  # gelesen in erkunden.sh
DOCKER_LAEUFT_NICHT=0
MYSQL_BIN=""
DUMP_BIN=""
DOCKER_IMAGE="${ERKUNDEN_DOCKER_IMAGE:-mariadb:11}"
DOCKER_CLIENT="ssmdb2-erkunden-client-$$"
DOCKER_NETZ=""                         # nur für den Selbsttest
ZUGANG_DIR=""
RO_INIT="SET SESSION TRANSACTION READ ONLY"
# shellcheck disable=SC2034  # gelesen in mitschnitt.sh, protokoll.sh, erkunden.sh
JETZT_SQL="NOW()"                      # NOW(3), wenn der Server Millisekunden kann (verbinden prüft das)
ZEITGRENZE_SQL=""                      # Zeitgrenze je Abfrage der Checkliste, je nach Server

# Sucht einen MySQL-Client. $1 = 1 erzwingt Docker. Rückgabe 1, wenn keiner da ist.
# Läuft je Aufruf mehrfach (Selbsttest, Verbinden): Reste eines früheren Treffers nicht übernehmen,
# sonst macht der zweite Aufruf aus dem Docker-Rückfall einen lokalen Client, den es nicht gibt.
client_finden() {
  local b
  CLIENT_MODUS=""
  MYSQL_BIN=""
  DUMP_BIN=""
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
  if command -v docker >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
    # shellcheck disable=SC2034  # gelesen in erkunden.sh
    DOCKER_LAEUFT_NICHT=1
    return 1
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
      # Der MariaDB-Client ab 11.4 verlangt sonst TLS mit gültigem Zertifikat und verweigert einen
      # Server ohne TLS ganz; ohne TLS auch kein Scheitern an alten TLS-Versionen. Die
      # Verbindung bleibt im lokalen Gerätenetz. Nur MariaDB-Clients lesen diese Gruppe.
      echo "[client-mariadb]"
      echo "skip-ssl"
      echo "skip-ssl-verify-server-cert"
    } >"$ZUGANG_DIR/zugang.cnf"
  )
}

# Startet im Docker-Fall einen Client-Container, in den jede Abfrage per `docker exec` geht.
client_starten() {
  [ "$CLIENT_MODUS" = docker ] || return 0
  local netz=""
  if [ -n "$DOCKER_NETZ" ]; then netz="--network=$DOCKER_NETZ"; fi
  # shellcheck disable=SC2086  # $netz ist leer oder genau ein Argument
  docker run -d --rm --name "$DOCKER_CLIENT" $netz -v "$ZUGANG_DIR:/zugang:ro" \
    --entrypoint sleep "$DOCKER_IMAGE" infinity >/dev/null
}

# Startet den Client-Container neu, wenn er nicht mehr läuft (etwa nach einem Neustart von Docker
# Desktop). Rückgabe 0 nur, wenn er neu gestartet wurde.
client_wiederbeleben() {
  [ "$CLIENT_MODUS" = docker ] || return 1
  if [ "$(docker inspect -f '{{.State.Running}}' "$DOCKER_CLIENT" 2>/dev/null)" = true ]; then return 1; fi
  docker rm -f "$DOCKER_CLIENT" >/dev/null 2>&1 || true
  client_starten 2>/dev/null
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

# Führt den Client mit Zugangsdatei aus, OHNE stdin: `docker exec -i` würde sonst Eingaben des Users
# verbrauchen, auch aus dem Mitschnitt im Hintergrund, während er eine Notiz tippt.
_client() {
  local bin=$1
  shift
  if [ "$CLIENT_MODUS" = docker ]; then
    docker exec "$DOCKER_CLIENT" "$bin" --defaults-extra-file="$(_cnf_pfad)" "$@" </dev/null
  else
    "$bin" --defaults-extra-file="$(_cnf_pfad)" "$@" </dev/null
  fi
}

# Wie _client, aber stdin wird durchgereicht (nur mit Umleitung aus einer Datei aufrufen).
_client_stdin() {
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

_mysql_stdin() {
  if [ -n "$RO_INIT" ]; then
    _client_stdin "$MYSQL_BIN" --connect-timeout=5 --init-command="$RO_INIT" --database="$DB" "$@"
  else
    _client_stdin "$MYSQL_BIN" --connect-timeout=5 --database="$DB" "$@"
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
# Abfrage (etwa weil das echte Schema anders aussieht), laufen die übrigen weiter (--force). Vorweg
# die Zeitgrenze je Abfrage, damit kein Vollscan die Anlage lange hält; ungepuffert, damit
# Fehler bei ihrer Abfrage stehen.
sql_datei_tabelle() {
  { if [ -n "$ZEITGRENZE_SQL" ]; then printf '%s;\n' "$ZEITGRENZE_SQL"; fi; cat "$1"; } |
    _mysql_stdin --table -vvv --force --unbuffered 2>&1 | sed '/^Bye$/d'
}

# Dump über den passenden Dump-Client; Argumente werden angehängt, Ausgabe auf stdout. Mit --force,
# damit eine View ohne SHOW VIEW-Recht nicht die ganze Kopie abbricht.
sql_dump() {
  _client "$DUMP_BIN" --force "$@" "$DB"
}

# Zusatzoptionen, die nur ein lokales mysqldump 8 braucht (gegen ältere Server und GTID).
dump_zusatz() {
  local hilfe
  [ "$DUMP_BIN" = mysqldump ] || return 0
  hilfe=$(_client "$DUMP_BIN" --help 2>/dev/null || true)
  case "$hilfe" in *column-statistics*) printf '%s\n' --column-statistics=0 ;; esac
  case "$hilfe" in *set-gtid-purged*) printf '%s\n' --set-gtid-purged=OFF ;; esac
}

# Beginn einer konsistenten Lese-Transaktion; ohne READ ONLY, wenn der Server es nicht kennt.
tx_start() {
  if [ -n "$RO_INIT" ]; then
    echo "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY"
  else
    echo "START TRANSACTION WITH CONSISTENT SNAPSHOT"
  fi
}

# Erkennt, was der Server kann: Millisekunden in NOW() und eine Zeitgrenze je Abfrage.
server_faehigkeiten() {
  local version
  # shellcheck disable=SC2034  # gelesen in mitschnitt.sh, protokoll.sh, erkunden.sh
  if sql_text "SELECT NOW(3)" >/dev/null 2>&1; then JETZT_SQL="NOW(3)"; else JETZT_SQL="NOW()"; fi
  version=$(sql_text "SELECT VERSION() AS v" 2>/dev/null | sed -n 2p || true)
  case "$version" in
    *MariaDB*) ZEITGRENZE_SQL="SET SESSION max_statement_time = 60" ;;
    *) if sql_text "SELECT @@max_execution_time" >/dev/null 2>&1; then
         ZEITGRENZE_SQL="SET SESSION max_execution_time = 60000"
       fi ;;
  esac
}

# Zeit des Macs in Millisekunden.
jetzt_ms() {
  perl -MTime::HiRes=time -e 'printf "%d\n", time * 1000'
}
