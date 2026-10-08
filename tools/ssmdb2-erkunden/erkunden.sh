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
# shellcheck source=lib/mitschnitt.sh
. "$HIER/lib/mitschnitt.sh"
# shellcheck source=lib/protokoll.sh
. "$HIER/lib/protokoll.sh"

HOST=192.168.10.200
PORT=3306
DB=SSMDB2
BENUTZER="${ERKUNDEN_USER:-}"
AUSGABE=""
AUTO=0
DOCKER_ERZWINGEN=0
VERBUNDEN=0
ALLE_PHASEN="selbsttest verbinden checkliste dump protokoll abschluss"

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
  local rc=$?
  set +e  # Aufräumen muss ganz laufen, auch wenn ein Schritt scheitert.
  # Reihenfolge: erst den Mitschnitt stoppen und das Protokoll sichern, dann den Client entfernen.
  if [ -n "$MITSCHNITT_PID" ]; then
    mitschnitt_stoppen
    protokoll_anonymisieren
  fi
  client_aufraeumen
  if [ "$rc" != 0 ] && [ -n "$AUSGABE" ]; then
    warnung "Abgebrochen. Bisherige Ergebnisse: $AUSGABE"
    warnung "Fortsetzen mit: $0 --ausgabe $AUSGABE <fehlende Phasen>"
  fi
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
  elif [ "$DOCKER_LAEUFT_NICHT" = 1 ]; then
    warnung "Docker ist installiert, läuft aber nicht: Docker Desktop starten."
    ok=0
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
    # Standard-Benutzer laut Meyton-Handbuch zur SSMDB2 (Seite 3); das Passwort steht ebenda.
    read -r -p "Benutzer [meyton]: " BENUTZER
    BENUTZER=${BENUTZER:-meyton}
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
  if ! client_finden "$DOCKER_ERZWINGEN"; then
    [ "$DOCKER_LAEUFT_NICHT" = 0 ] || fehler "Docker Desktop läuft nicht: bitte starten und erneut versuchen"
    fehler "kein MySQL-Client (erst: erkunden.sh selbsttest)"
  fi
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
  server_faehigkeiten
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
  anlage_ms=$(sql_text "SELECT ROUND(UNIX_TIMESTAMP($JETZT_SQL) * 1000) AS ms" 2>/dev/null | sed -n 2p || true)
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
    abschnitt_sql "SELECT VERSION() AS version, @@version_comment AS art, $JETZT_SQL AS jetzt_anlage,
      UTC_TIMESTAMP() AS utc_anlage, @@session.time_zone AS sitzung_tz,
      @@global.time_zone AS global_tz, @@system_time_zone AS system_tz"
    echo
    if [ -n "$anlage_ms" ]; then
      echo "Uhr der Anlage minus Uhr des Macs: $((anlage_ms - (vorher + nachher) / 2)) ms" \
        "(Abfrage dauerte $((nachher - vorher)) ms; SF-29)."
    else
      echo "Uhr der Anlage nicht lesbar."
    fi
    echo
    echo "- Millisekunden in NOW(): $([ "$JETZT_SQL" = "NOW(3)" ] && echo ja || echo nein)"
    echo "- Zeitgrenze je Abfrage der Checkliste: ${ZEITGRENZE_SQL:-keine (Server kennt keine)}"
    echo
    echo "## Zeichensatz"
    echo
    abschnitt_sql "SHOW VARIABLES WHERE Variable_name LIKE 'character_set%' OR Variable_name LIKE 'collation%'"
    echo
    echo "## Tabellen"
    echo
    abschnitt_sql "SHOW TABLES"
    echo
    echo "## Tabelle Version"
    echo
    abschnitt_sql "SELECT * FROM Version"
    echo
    echo "## Netz (SF-57)"
    echo
    netz_pruefen | md_code
  } >"$datei"
}

# Eine Abfrage als Codeblock; scheitert sie, steht der Fehler im Bericht und der Lauf geht weiter.
abschnitt_sql() {
  { sql_tabelle "$1" 2>&1 || echo "(nicht lesbar)"; } | md_code
}

netz_pruefen() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://example.com || true)
  echo "Internet vom Mac aus (https://example.com): HTTP ${code:-keine Antwort}"
  echo "Standard-Route: $(route -n get default 2>/dev/null | awk '/gateway|interface/ {printf "%s ", $0}' || true)"
  if command -v smbutil >/dev/null 2>&1; then
    echo "Freigaben auf $HOST (smbutil view, nur Gast, ohne Passwortabfrage):"
    smbutil view -N -g "//$HOST" 2>&1 | sed 's/^/  /' || true
  else
    echo "smbutil nicht vorhanden; Freigaben nicht geprüft"
  fi
}

# ---------------------------------------------------------------- Phase checkliste

# Führt alle Dateien aus abfragen/ aus und schreibt Fragen, Belege und Ergebnisse als Markdown.
checkliste_schreiben() {
  local datei=$1 sql thema start
  {
    echo "# Antworten aus der SQL-Checkliste"
    echo
    echo "- Stand: $(date '+%Y-%m-%d %H:%M:%S %z') (Mac), Server $HOST, Datenbank $DB"
    echo "- Personenbezüge nur als Anzahlen; Abfragen: tools/ssmdb2-erkunden/abfragen/"
    echo
    for sql in "$HIER"/abfragen/*.sql; do
      thema=$(sed -n 's/^-- Thema: //p' "$sql")
      echo "## $(basename "$sql" .sql): $thema"
      echo
      sed -n -e 's/^-- Frage: /- Frage: /p' -e 's/^-- Belegt: /- Belegt: /p' "$sql"
      echo
      start=$(jetzt_ms)
      sql_datei_tabelle "$sql" | md_code
      echo
      echo "Dauer: $(($(jetzt_ms) - start)) ms"
      echo
    done
  } >"$datei"
}

phase_checkliste() {
  verbindung_sicherstellen
  info "SQL-Checkliste: liest ganze Tabellen. Nur ausführen, wenn gerade niemand schießt."
  frage_ja "Schießt gerade niemand? Checkliste jetzt ausführen?" || {
    warnung "Checkliste übersprungen"
    return 0
  }
  checkliste_schreiben "$AUSGABE/bericht/antworten.md"
  info "Checkliste geschrieben: $AUSGABE/bericht/antworten.md"
}

# ---------------------------------------------------------------- Phase dump

# Kopie der ganzen SSMDB2 nach privat/ (mit Namen) und das Schema ohne Daten nach bericht/.
# Ohne LOCK TABLES: unter MyISAM würde das ShootMaster blockieren (SF-51).
phase_dump() {
  verbindung_sicherstellen
  info "Kopie der SSMDB2: liest alle Tabellen. Nur ausführen, wenn gerade niemand schießt."
  frage_ja "Schießt gerade niemand? Kopie jetzt ziehen?" || {
    warnung "Kopie übersprungen"
    return 0
  }
  local roh="$AUSGABE/privat/ssmdb2.sql.gz" bericht="$AUSGABE/bericht/dump.md" fehler="$AUSGABE/privat/dump-fehler.txt"
  local start dauer zusatz tabelle stand="vollständig"
  zusatz=$(dump_zusatz)
  start=$(jetzt_ms)
  # shellcheck disable=SC2086  # $zusatz sind null bis zwei einzelne Optionen
  if ! sql_dump --single-transaction --skip-lock-tables --no-tablespaces --hex-blob $zusatz 2>"$fehler" | gzip >"$roh"; then
    stand="unvollständig"
    warnung "Die Kopie ist unvollständig (Fehler in privat/dump-fehler.txt); der Rest läuft weiter."
  fi
  dauer=$(($(jetzt_ms) - start))
  chmod 600 "$roh"
  # shellcheck disable=SC2086
  sql_dump --no-data --skip-lock-tables --no-tablespaces --skip-comments $zusatz \
    >"$AUSGABE/bericht/schema.sql" 2>/dev/null || warnung "Schema nur teilweise gelesen"
  {
    echo "# Kopie der SSMDB2"
    echo
    echo "- Datei: privat/ssmdb2.sql.gz (enthält Namen, bleibt auf diesem Rechner; einspielen mit einem MariaDB-Client)"
    echo "- Stand: $stand"
    echo "- Größe: $(wc -c <"$roh" | tr -d ' ') Bytes gepackt, Dauer $dauer ms"
    echo "- Schema ohne Daten: bericht/schema.sql"
    if [ "$stand" != "vollständig" ]; then
      echo
      echo "## Fehler beim Kopieren"
      echo
      head -5 "$fehler" | md_code
    fi
    echo
    echo "## Zeilen je Tabelle"
    echo
    for tabelle in $(sql_text "SHOW TABLES" 2>/dev/null | sed 1d || true); do
      printf -- '- %s: %s\n' "$tabelle" \
        "$(sql_text "SELECT COUNT(*) FROM \`$tabelle\`" 2>/dev/null | sed -n 2p || echo "nicht lesbar")"
    done
  } >"$bericht"
  info "Kopie geschrieben: $roh ($dauer ms, $stand)"
}

# ---------------------------------------------------------------- Phase protokoll

# Rohprotokoll (mit Namen) -> bericht/protokoll.tsv mit stabilen Pseudonymen.
protokoll_anonymisieren() {
  local roh="$AUSGABE/privat/protokoll-roh.tsv"
  [ -f "$roh" ] || return 0
  chmod 600 "$roh"
  awk -f "$HIER/lib/anonym.awk" "$roh" >"$AUSGABE/bericht/protokoll.tsv"
}

phase_protokoll() {
  verbindung_sicherstellen
  info "Schießprotokoll: Das Skript liest jede Sekunde mit, während du die Schritte schießt."
  info "Jeder Schritt lässt sich mit s überspringen, q beendet das Protokoll."
  frage_ja "Bereit? Mitschnitt jetzt starten?" || {
    warnung "Protokoll übersprungen"
    return 0
  }
  MITSCHNITT_DATEI="$AUSGABE/privat/protokoll-roh.tsv"
  if mitschnitt_vorpruefen; then
    mitschnitt_starten
  else
    warnung "Ohne Mitschnitt fehlt das Wichtigste (Probe, Zeitstempel, Latenz)."
    frage_ja "Trotzdem die Schritte durchgehen (nur Notizen und IDs der Ausdrucke)?" || return 0
  fi
  protokoll_schiessen
  if [ -n "$MITSCHNITT_PID" ]; then
    info "Letzte Änderungen abwarten …"
    sleep 3
    mitschnitt_stoppen
  fi
  protokoll_anonymisieren
  info "Protokoll geschrieben: $AUSGABE/bericht/schritte.md, $AUSGABE/bericht/protokoll.tsv"
}

# ---------------------------------------------------------------- Phase abschluss

# Sucht Namen und Sportpassnummern aus der Ablage als ganze Wörter in bericht/. Meldet nur Anzahlen
# je Datei, nie den Namen. Die Liste liegt nur kurz in privat/. Kurze Sportpassnummern (unter fünf
# Stellen) bleiben außen vor, sie träfen sonst jede Zahl. Scheitert die Abfrage, gibt es keine
# Entwarnung (Review S1).
namen_pruefen() {
  local liste datei treffer gesamt=0
  liste=$(mktemp "$AUSGABE/privat/.namen.XXXXXX")
  if ! sql_text "SELECT DISTINCT Nachname AS n FROM Scheiben WHERE CHAR_LENGTH(TRIM(Nachname)) >= 3
      UNION SELECT DISTINCT Vorname FROM Scheiben WHERE CHAR_LENGTH(TRIM(Vorname)) >= 3
      UNION SELECT DISTINCT CAST(SportpassID AS CHAR) FROM Scheiben WHERE SportpassID >= 10000" \
    >"$liste.roh" 2>/dev/null; then
    rm -f "$liste" "$liste.roh"
    echo "Namensprüfung nicht möglich (Spalten Nachname/Vorname/SportpassID nicht lesbar); bericht/ vor dem Weitergeben selbst durchsehen"
    return 0
  fi
  sed 1d "$liste.roh" | grep -v -x -e '--frei--' -e 'NULL' >"$liste" || true
  rm -f "$liste.roh"
  if [ ! -s "$liste" ]; then
    rm -f "$liste"
    echo "Namensprüfung: keine Namen in der Ablage"
    return 0
  fi
  for datei in "$AUSGABE"/bericht/*; do
    treffer=$(grep -c -w -F -f "$liste" "$datei" || true)
    if [ "$treffer" -gt 0 ]; then
      echo "Namensprüfung: $(basename "$datei"): $treffer Zeilen mit einem Namen oder einer Sportpassnummer"
      gesamt=$((gesamt + treffer))
    fi
  done
  rm -f "$liste"
  if [ "$gesamt" = 0 ]; then echo "Namensprüfung: keine Treffer in bericht/"; fi
}

liesmich_zeile() {
  if [ -e "$AUSGABE/bericht/$1" ]; then echo "| $1 | $2 |"; fi
}

phase_abschluss() {
  verbindung_sicherstellen
  local liesmich="$AUSGABE/bericht/LIESMICH.md" pruefung
  if frage_ja "Schießt niemand mehr? Checkliste ein zweites Mal ausführen (mit den Scheiben von heute)?"; then
    checkliste_schreiben "$AUSGABE/bericht/antworten-danach.md"
  fi
  pruefung=$(namen_pruefen)
  {
    echo "# SSMDB2-Erkundung $(date '+%Y-%m-%d')"
    echo
    case "$pruefung" in
      *"keine Treffer"* | *"keine Namen in der Ablage"*)
        echo "Dieser Ordner (bericht/) enthält keine Namen und Sportpassnummern und darf weitergegeben werden." ;;
      *)
        echo "**Vor dem Weitergeben prüfen:** Die Namensprüfung unten hat Treffer oder war nicht möglich." ;;
    esac
    echo "Der Ordner privat/ daneben enthält die vollständige Kopie mit Namen und bleibt auf diesem Rechner."
    echo
    echo "| Datei | Inhalt |"
    echo "|---|---|"
    liesmich_zeile umgebung.md "Server, Uhr, Zeitzonen, Zeichensatz, Netz"
    liesmich_zeile antworten.md "SQL-Checkliste vor dem Schießen"
    liesmich_zeile antworten-danach.md "dieselbe Checkliste danach"
    liesmich_zeile schema.sql "Tabellen ohne Daten"
    liesmich_zeile dump.md "Größe der Kopie, Zeilen je Tabelle"
    liesmich_zeile schritte.md "geführte Schritte mit Zeit, Notizen, IDs der Ausdrucke"
    liesmich_zeile protokoll.tsv "Mitschnitt jeder Änderung (Namen als P1, P2 …, Sportpass als S1, S2 …)"
    echo
    echo "## Prüfung"
    echo
    # shellcheck disable=SC2001  # Präfix für jede Zeile einer mehrzeiligen Ausgabe
    echo "$pruefung" | sed 's/^/- /'
  } >"$liesmich"
  echo "$pruefung" >&2
  info "Fertig. Weitergeben: $AUSGABE/bericht — privat/ bleibt hier."
}

# ---------------------------------------------------------------- Ablauf

# Der Mac darf während des Abends nicht einschlafen, sonst steht der Mitschnitt (Review S6).
if [ "$AUTO" = 0 ] && command -v caffeinate >/dev/null 2>&1; then
  caffeinate -dims -w $$ >/dev/null 2>&1 &
fi

for phase in $PHASEN; do
  case "$phase" in
    selbsttest) phase_selbsttest ;;
    verbinden) phase_verbinden ;;
    checkliste) phase_checkliste ;;
    dump) phase_dump ;;
    protokoll) phase_protokoll ;;
    abschluss) phase_abschluss ;;
    *) fehler "unbekannte Phase: $phase (bekannt: $ALLE_PHASEN)" ;;
  esac
done
if [ -n "$AUSGABE" ]; then info "Ausgabe: $AUSGABE"; fi
