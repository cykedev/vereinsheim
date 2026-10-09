# shellcheck shell=bash
# Mitschnitt während des Schießprotokolls (SP-0.6): liest wie die Brücke und schreibt jeden neuen
# Stand mit Zeit in privat/protokoll-roh.tsv. Nur lesen; ein Stand ist eine Read-only-Transaktion.
#
# Format: Blöcke, jeder beginnt mit
#   # stand mac_ms=<ms> anlage=<Anlagenzeit> dauer_ms=<ms> takt_s=<s>
# danach je Tabelle eine Markerzeile (#Scheiben, #Serien, #Treffer) und die Zeilen tab-getrennt mit
# Kopfzeile, wie der Client sie liefert (NULL wörtlich). Dazwischen Ereigniszeilen (# schritt …,
# # takt …, # fehler …). dauer_ms misst nur die Stand-Abfrage, samt Client-Aufwand; dessen Grundlast
# (SELECT 1, im Docker-Fall vor allem `docker exec`) steht in der Startzeile als basis_ms.
#
# Während der Mitschnitt läuft, schreibt nur er in das Rohprotokoll. Marker der Schritte gehen über
# eine eigene Datei, die er bei jedem Durchgang übernimmt; so zerteilt kein Marker einen Block.

MITSCHNITT_PID=""
MITSCHNITT_STOP=""
MITSCHNITT_DATEI=""
MITSCHNITT_MARKER=""
MITSCHNITT_SEIT=""
MITSCHNITT_TAKT_MAX=8
MITSCHNITT_LANGSAM_MS=300
MITSCHNITT_BASIS_MS=0
MITSCHNITT_NETZ_S=10        # Abstand des Netzes über Treffer.Zeitstempel; 60 bei Vollscan, 0 = aus
# Fenster für den Abend im laufenden Betrieb (Phase abend): nur Scheiben lesen, die sich in den letzten
# N Sekunden geändert haben, und das Fenster alle MITSCHNITT_FENSTER_TAKT_S nachziehen. 0 = aus
# (Protokoll: alle seit Start).
MITSCHNITT_FENSTER_S=0
MITSCHNITT_FENSTER_TAKT_S=60

# Die Fehlerzeile einer Client-Ausgabe: Der MariaDB-Client schreibt zuerst die Anweisung, dann ERROR.
_fehlerzeile() {
  printf '%s\n' "$1" | grep -m1 '^ERROR' || printf '%s\n' "$1" | tail -1
}

# Ereigniszeile direkt ins Rohprotokoll (nur, wenn der Mitschnitt nicht läuft, oder aus ihm selbst).
mitschnitt_ereignis() {
  printf '# %s mac_ms=%s\n' "$*" "$(jetzt_ms)" >>"$MITSCHNITT_DATEI"
}

# Ereigniszeile aus der Hauptshell, während der Mitschnitt läuft: über die Marker-Datei.
mitschnitt_marker() {
  if [ -n "$MITSCHNITT_PID" ]; then
    printf '# %s mac_ms=%s\n' "$*" "$(jetzt_ms)" >>"$MITSCHNITT_MARKER"
  else
    mitschnitt_ereignis "$@"
  fi
}

# Fügt die IDs aus stdin (eine je Zeile) zur Leerzeichen-Liste $1 hinzu, ohne Doppelte.
_ids_vereinigen() {
  local liste=" $1 " id
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    case "$liste" in *" $id "*) ;; *) liste="$liste$id " ;; esac
  done
  printf '%s' "$liste" | tr -s ' ' | sed 's/^ //; s/ $//'
}

# Zieht den Beginn des Fensters nach: jüngster Eintrag oder Server-Uhr, was früher ist, minus
# MITSCHNITT_FENSTER_S (wie mitschnitt_vorpruefen). Nie zurück; bei einem Fehler bleibt $1.
_fenster_seit() {
  local neu
  neu=$(sql_text "SELECT LEAST(NOW(), COALESCE(MAX(Zeitstempel), NOW())) - INTERVAL $MITSCHNITT_FENSTER_S SECOND
    AS seit FROM Scheiben" 2>/dev/null | sed -n 2p || true)
  if [ -n "$neu" ] && [[ "$neu" > "$1" ]]; then printf '%s\n' "$neu"; else printf '%s\n' "$1"; fi
}

# Behält von den IDs $1 die, deren Scheibe oder Treffer sich seit $2 geändert haben; liest über den
# Primärschlüssel, kein Vollscan. Bei einem Fehler bleiben alle (lieber zu viel lesen als verlieren).
_ids_aktiv() {
  local liste antwort
  [ -n "$1" ] || return 0
  liste=$(printf '%s' "$1" | tr ' ' ',')
  if antwort=$(sql_text "SELECT ScheibenID FROM Scheiben WHERE ScheibenID IN ($liste) AND Zeitstempel >= '$2'
      UNION SELECT ScheibenID FROM Treffer WHERE ScheibenID IN ($liste)
      GROUP BY ScheibenID HAVING MAX(Zeitstempel) >= '$2'" 2>/dev/null); then
    printf '%s\n' "$antwort" | sed 1d | _ids_vereinigen ""
  else
    printf '%s' "$1"
  fi
}

# IDs aus $1, die in $2 fehlen (Leerzeichen-Listen).
_ids_ohne() {
  local id weg=""
  for id in $1; do
    case " $2 " in *" $id "*) ;; *) weg="$weg $id" ;; esac
  done
  printf '%s' "${weg# }"
}

# Übernimmt neue Zeilen der Marker-Datei; $1 = schon übernommene Zeilen, Ausgabe = neue Anzahl.
_marker_uebernehmen() {
  local erledigt=$1 gesamt
  gesamt=$(wc -l <"$MITSCHNITT_MARKER" | tr -d ' ')
  if [ "$gesamt" -gt "$erledigt" ]; then
    sed -n "$((erledigt + 1)),${gesamt}p" "$MITSCHNITT_MARKER" >>"$MITSCHNITT_DATEI"
  fi
  printf '%s\n' "$gesamt"
}

_stand_sql() {
  printf '%s;\n' "$(tx_start)" \
    "SELECT CONCAT('#jetzt ', $JETZT_SQL) AS '#'" \
    "SELECT '#Scheiben' AS '#'" \
    "SELECT * FROM Scheiben WHERE $1 ORDER BY ScheibenID" \
    "SELECT '#Serien' AS '#'" \
    "SELECT * FROM Serien WHERE $1 ORDER BY ScheibenID, Stellung, Serie" \
    "SELECT '#Treffer' AS '#'" \
    "SELECT * FROM Treffer WHERE $1 ORDER BY ScheibenID, Stellung, Treffer" \
    "COMMIT"
}

_mitschnitt_schleife() {
  local seit=$1 takt=1 schnell=0 ids="" vorher="" marker=0 letztes_netz=0 letztes_fenster
  local stand t0 dauer anlage koerper neu aktiv weg
  letztes_fenster=$(jetzt_ms)
  while [ ! -f "$MITSCHNITT_STOP" ]; do
    marker=$(_marker_uebernehmen "$marker")
    # Abend: Fenster nachziehen und Scheiben ohne Änderung darin nicht mehr lesen. Das Ereignis nennt
    # sie, damit eine ausgeschiedene Scheibe nicht als gelöscht gelesen wird; nur, wenn eine ausscheidet
    # (die Abfrage liefert dieselben IDs auch in anderer Reihenfolge).
    if [ "$MITSCHNITT_FENSTER_S" -gt 0 ] &&
      [ $(($(jetzt_ms) - letztes_fenster)) -ge $((MITSCHNITT_FENSTER_TAKT_S * 1000)) ]; then
      letztes_fenster=$(jetzt_ms)
      seit=$(_fenster_seit "$seit")
      aktiv=$(_ids_aktiv "$ids" "$seit")
      weg=$(_ids_ohne "$ids" "$aktiv")
      if [ -n "$weg" ]; then mitschnitt_ereignis "fenster seit=$seit ausgeschieden=$(printf '%s' "$weg" | tr ' ' ',')"; fi
      ids=$aktiv
      letztes_netz=0
    fi
    if ! neu=$(sql_text "SELECT ScheibenID FROM Scheiben WHERE Zeitstempel >= '$seit'" 2>&1); then
      mitschnitt_ereignis "fehler $(_fehlerzeile "$neu")"
      _nach_fehler "$takt"
      continue
    fi
    ids=$(printf '%s\n' "$neu" | sed 1d | _ids_vereinigen "$ids")
    # Netz für den Fall, dass Scheiben.Zeitstempel bei Probe nicht steigt (SF-50), nach der Uhr getaktet.
    if [ "$MITSCHNITT_NETZ_S" -gt 0 ] && [ $(($(jetzt_ms) - letztes_netz)) -ge $((MITSCHNITT_NETZ_S * 1000)) ]; then
      letztes_netz=$(jetzt_ms)
      if neu=$(sql_text "SELECT DISTINCT ScheibenID FROM Treffer WHERE Zeitstempel >= '$seit'" 2>&1); then
        ids=$(printf '%s\n' "$neu" | sed 1d | _ids_vereinigen "$ids")
      fi
    fi
    if [ -n "$ids" ]; then
      t0=$(jetzt_ms)
      if stand=$(sql_text "$(_stand_sql "ScheibenID IN ($(printf '%s' "$ids" | tr ' ' ','))")" 2>&1); then
        dauer=$(($(jetzt_ms) - t0))
        anlage=$(printf '%s\n' "$stand" | sed -n 's/^#jetzt //p')
        # Nur die Kopfzeile des Markers ("#") und die Zeit weglassen, sonst wäre jeder Stand neu.
        koerper=$(printf '%s\n' "$stand" | sed -e '/^#$/d' -e '/^#jetzt /d')
        if [ "$koerper" != "$vorher" ]; then
          {
            printf '# stand mac_ms=%s anlage=%s dauer_ms=%s takt_s=%s\n' "$t0" "$anlage" "$dauer" "$takt"
            printf '%s\n' "$koerper"
          } >>"$MITSCHNITT_DATEI"
          vorher=$koerper
        fi
        # Takt: verdoppeln, wenn die Datenbank spürbar arbeitet (SF-49, SF-52); nach zehn schnellen
        # Durchgängen wieder halbieren. Gezählt wird nur, was über der Grundlast des Clients liegt.
        if [ $((dauer - MITSCHNITT_BASIS_MS)) -gt "$MITSCHNITT_LANGSAM_MS" ]; then
          schnell=0
          if [ "$takt" -lt "$MITSCHNITT_TAKT_MAX" ]; then
            takt=$((takt * 2))
            mitschnitt_ereignis "takt ${takt}s nach Abfrage mit ${dauer} ms (Grundlast $MITSCHNITT_BASIS_MS ms)"
          fi
        else
          schnell=$((schnell + 1))
          if [ "$takt" -gt 1 ] && [ "$schnell" -ge 10 ]; then
            takt=$((takt / 2))
            schnell=0
            mitschnitt_ereignis "takt ${takt}s nach zehn schnellen Abfragen"
          fi
        fi
      else
        mitschnitt_ereignis "fehler $(_fehlerzeile "$stand")"
        _nach_fehler 0
      fi
    fi
    sleep "$takt"
  done
  _marker_uebernehmen "$marker" >/dev/null
}

# Nach einem Fehler: Am Abend den Docker-Client wiederbeleben, falls er weg ist, und nicht im
# Sekundentakt gegen eine fehlende Verbindung laufen. $1 = Pause (0 = keine).
_nach_fehler() {
  if [ "$MITSCHNITT_FENSTER_S" -gt 0 ]; then
    if client_wiederbeleben; then mitschnitt_ereignis "client neu gestartet"; fi
    sleep 5
  elif [ "$1" -gt 0 ]; then
    sleep "$1"
  fi
}

# Grundlast einer Abfrage: das Schnellste von drei SELECT 1.
_grundlast_messen() {
  local min="" t0 d
  for _ in 1 2 3; do
    t0=$(jetzt_ms)
    sql_text "SELECT 1" >/dev/null
    d=$(($(jetzt_ms) - t0))
    if [ -z "$min" ] || [ "$d" -lt "$min" ]; then min=$d; fi
  done
  printf '%s\n' "$min"
}

# Spalte "type" aus der ersten EXPLAIN-Zeile.
_explain_typ() {
  sql_text "EXPLAIN $1" 2>/dev/null | awk -F'\t' 'NR == 1 { for (i = 1; i <= NF; i++) if ($i == "type") s = i; next }
    NR == 2 && s { print $s }'
}

# Prüft im Vordergrund, ob der Mitschnitt überhaupt lesen kann. Setzt das Zeitfenster aus den Daten:
# die Zeit des jüngsten Eintrags oder die Server-Uhr, was früher ist, minus zehn Minuten. So schadet ein
# Versatz zwischen Server-Uhr und Zeitstempeln nicht (Review B2, SF-29/SF-31). Rückgabe 1 bei Fehlern.
mitschnitt_vorpruefen() {
  local fehler="" antwort typ
  if ! antwort=$(sql_text "SELECT LEAST(NOW(), COALESCE(MAX(Zeitstempel), NOW())) - INTERVAL 10 MINUTE AS seit
      FROM Scheiben" 2>&1); then
    fehler="Zeitfenster aus Scheiben.Zeitstempel: $(printf '%s' "$antwort" | tail -1)"
  else
    MITSCHNITT_SEIT=$(printf '%s\n' "$antwort" | sed -n 2p)
  fi
  if [ -z "$fehler" ] && ! antwort=$(sql_text "$(_stand_sql "1 = 0")" 2>&1); then
    fehler="Stand-Abfrage (Scheiben, Serien, Treffer): $(printf '%s' "$antwort" | tail -1)"
  fi
  if [ -n "$fehler" ]; then
    warnung "Der Mitschnitt kann nicht lesen: $fehler"
    return 1
  fi
  typ=$(_explain_typ "SELECT DISTINCT ScheibenID FROM Treffer WHERE Zeitstempel >= '$MITSCHNITT_SEIT'")
  case "$typ" in
    "") MITSCHNITT_NETZ_S=0 ;;
    range | ref | eq_ref | const | system) MITSCHNITT_NETZ_S=10 ;;
    *) MITSCHNITT_NETZ_S=60 ;;  # ALL und index lesen die ganze Tabelle bzw. den ganzen Index
  esac
  info "Mitschnitt liest ab $MITSCHNITT_SEIT (Anlagenzeit); Netz über Treffer alle ${MITSCHNITT_NETZ_S}s (EXPLAIN: ${typ:-nicht lesbar})"
  return 0
}

# Startet den Mitschnitt im Hintergrund (nach mitschnitt_vorpruefen).
mitschnitt_starten() {
  MITSCHNITT_DATEI="$AUSGABE/privat/protokoll-roh.tsv"
  MITSCHNITT_STOP="$AUSGABE/privat/.mitschnitt-stop"
  MITSCHNITT_MARKER="$AUSGABE/privat/.mitschnitt-marker"
  rm -f "$MITSCHNITT_STOP"
  : >"$MITSCHNITT_MARKER"
  MITSCHNITT_BASIS_MS=$(_grundlast_messen)
  mitschnitt_ereignis "start seit=$MITSCHNITT_SEIT basis_ms=$MITSCHNITT_BASIS_MS netz_s=$MITSCHNITT_NETZ_S fenster_s=$MITSCHNITT_FENSTER_S"
  # Ohne stdin: Der Mitschnitt darf nie Eingaben des Users lesen.
  _mitschnitt_schleife "$MITSCHNITT_SEIT" </dev/null &
  MITSCHNITT_PID=$!
}

# Eine Zeile zum Stand des Mitschnitts für den User; Rückgabe 1, wenn er noch nichts gesehen hat.
mitschnitt_status() {
  local staende fehler lauf="läuft"
  # Nur ab dem letzten Start zählen: Ein fortgesetzter Lauf schreibt in dieselbe Datei.
  staende=$(awk '/^# start / { n = 0 } /^# stand / { n++ } END { print n + 0 }' "$MITSCHNITT_DATEI" 2>/dev/null || echo 0)
  # Ein Fehler zählt nur, bis wieder ein Stand kommt; sonst stünde er nach einem Aussetzer den ganzen Abend da.
  fehler=$(awk '/^# (start|stand) / { f = "" } /^# fehler / { f = substr($0, 3, 118) } END { print f }' "$MITSCHNITT_DATEI" 2>/dev/null || true)
  if [ -n "$MITSCHNITT_PID" ] && ! kill -0 "$MITSCHNITT_PID" 2>/dev/null; then lauf="STEHT"; fi
  info "Mitschnitt: ${staende:-0} Stände, $lauf${fehler:+, zuletzt: $fehler}"
  [ "${staende:-0}" -gt 0 ]
}

mitschnitt_stoppen() {
  [ -n "$MITSCHNITT_PID" ] || return 0
  touch "$MITSCHNITT_STOP"
  wait "$MITSCHNITT_PID" 2>/dev/null || true
  MITSCHNITT_PID=""
  rm -f "$MITSCHNITT_STOP" "$MITSCHNITT_MARKER"
  mitschnitt_ereignis "ende"
}
