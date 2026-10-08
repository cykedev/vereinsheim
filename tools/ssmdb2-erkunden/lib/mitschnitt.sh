# shellcheck shell=bash
# Mitschnitt während des Schießprotokolls (SP-0.6): liest wie die Brücke und schreibt jeden neuen
# Stand mit Zeit in privat/protokoll-roh.tsv. Nur lesen; ein Durchgang ist eine Read-only-Transaktion.
#
# Format: Blöcke, jeder beginnt mit
#   # stand mac_ms=<ms> anlage=<NOW(3)> dauer_ms=<ms> takt_s=<s>
# dauer_ms ist die ganze Abfrage samt Client-Aufwand; die Grundlast (SELECT 1, im Docker-Fall vor allem
# `docker exec`) steht in der Startzeile als basis_ms. Die Datenbank kostet also dauer_ms - basis_ms.
# danach je Tabelle eine Markerzeile (#Scheiben, #Serien, #Treffer) und die Zeilen tab-getrennt mit
# Kopfzeile, wie der Client sie liefert (NULL wörtlich). Dazwischen Ereigniszeilen (# schritt …,
# # takt …, # fehler …).

MITSCHNITT_PID=""
MITSCHNITT_STOP=""
MITSCHNITT_DATEI=""
MITSCHNITT_TAKT_MAX=8
MITSCHNITT_LANGSAM_MS=300
MITSCHNITT_BASIS_MS=0

# Hängt eine Ereigniszeile an das Rohprotokoll an.
mitschnitt_ereignis() {
  printf '# %s mac_ms=%s\n' "$*" "$(jetzt_ms)" >>"$MITSCHNITT_DATEI"
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

_mitschnitt_schleife() {
  local seit=$1 takt=1 durchgang=0 ids="" vorher="" stand t0 dauer anlage koerper liste neu
  while [ ! -f "$MITSCHNITT_STOP" ]; do
    durchgang=$((durchgang + 1))
    t0=$(jetzt_ms)
    if ! neu=$(sql_text "SELECT ScheibenID FROM Scheiben WHERE Zeitstempel >= '$seit'" 2>&1); then
      mitschnitt_ereignis "fehler $(printf '%s' "$neu" | head -1)"
      sleep "$takt"
      continue
    fi
    ids=$(printf '%s\n' "$neu" | sed 1d | _ids_vereinigen "$ids")
    # Netz für den Fall, dass Scheiben.Zeitstempel bei Probe nicht steigt (SF-50): alle 10 Durchgänge.
    if [ $((durchgang % 10)) = 1 ]; then
      if neu=$(sql_text "SELECT DISTINCT ScheibenID FROM Treffer WHERE Zeitstempel >= '$seit'" 2>&1); then
        ids=$(printf '%s\n' "$neu" | sed 1d | _ids_vereinigen "$ids")
      fi
    fi
    if [ -n "$ids" ]; then
      liste=$(printf '%s' "$ids" | tr ' ' ',')
      if stand=$(sql_text "$(tx_start);
          SELECT CONCAT('#jetzt ', NOW(3)) AS '#';
          SELECT '#Scheiben' AS '#';
          SELECT * FROM Scheiben WHERE ScheibenID IN ($liste) ORDER BY ScheibenID;
          SELECT '#Serien' AS '#';
          SELECT * FROM Serien WHERE ScheibenID IN ($liste) ORDER BY ScheibenID, Stellung, Serie;
          SELECT '#Treffer' AS '#';
          SELECT * FROM Treffer WHERE ScheibenID IN ($liste) ORDER BY ScheibenID, Stellung, Treffer;
          COMMIT;" 2>&1); then
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
      else
        mitschnitt_ereignis "fehler $(printf '%s' "$stand" | head -1)"
        dauer=$(($(jetzt_ms) - t0))
      fi
      # Zu langsam für den Rechner, der live wertet: Takt verdoppeln (SF-49, SF-52). Gezählt wird nur,
      # was über der Grundlast des Clients liegt.
      if [ $((dauer - MITSCHNITT_BASIS_MS)) -gt "$MITSCHNITT_LANGSAM_MS" ] && [ "$takt" -lt "$MITSCHNITT_TAKT_MAX" ]; then
        takt=$((takt * 2))
        mitschnitt_ereignis "takt ${takt}s nach Abfrage mit ${dauer} ms"
      fi
    fi
    sleep "$takt"
  done
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

# Startet den Mitschnitt im Hintergrund. Gelesen wird alles ab der Anlagenzeit minus 10 Minuten.
mitschnitt_starten() {
  local seit
  MITSCHNITT_DATEI="$AUSGABE/privat/protokoll-roh.tsv"
  MITSCHNITT_STOP="$AUSGABE/privat/.mitschnitt-stop"
  rm -f "$MITSCHNITT_STOP"
  seit=$(sql_text "SELECT NOW() - INTERVAL 10 MINUTE AS seit" | sed -n 2p)
  MITSCHNITT_BASIS_MS=$(_grundlast_messen)
  mitschnitt_ereignis "start seit=$seit basis_ms=$MITSCHNITT_BASIS_MS"
  # Ohne stdin: Der Mitschnitt darf nie Eingaben des Users lesen.
  _mitschnitt_schleife "$seit" </dev/null &
  MITSCHNITT_PID=$!
}

mitschnitt_stoppen() {
  [ -n "$MITSCHNITT_PID" ] || return 0
  touch "$MITSCHNITT_STOP"
  wait "$MITSCHNITT_PID" 2>/dev/null || true
  MITSCHNITT_PID=""
  rm -f "$MITSCHNITT_STOP"
  mitschnitt_ereignis "ende"
}
