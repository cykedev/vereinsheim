# shellcheck shell=bash
# Geführtes Schießprotokoll, allein schießbar. Nach jedem Schritt ein Marker in
# bericht/schritte.md und im Rohprotokoll; der Mitschnitt läuft daneben (lib/mitschnitt.sh).
# Im Auto-Modus (Selbsttest) ruft das Skript vor jedem Schritt $ERKUNDEN_AUTO_HOOK <nr> auf, statt
# auf Enter zu warten; Schritte in $ERKUNDEN_AUTO_UEBERSPRINGEN werden übersprungen, PDF-IDs kommen
# aus $ERKUNDEN_AUTO_PDF_IDS.

SCHRITTE_DATEI=""

# Dekodiert die ID aus dem Fuß eines Ausdrucks (8 Hex-Zeichen) als vorzeichenbehaftete 32-Bit-Zahl.
# Ausgabe leer, wenn die Eingabe kein gültiges Muster ist.
pdf_id_dekodieren() {
  local hex wert
  hex=$(printf '%s' "$1" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
  case "$hex" in id:*) hex=${hex#id:} ;; esac
  printf '%s' "$hex" | grep -Eq '^[0-9a-f]{8}$' || return 0
  wert=$((16#$hex))
  if [ "$wert" -ge 2147483648 ]; then wert=$((wert - 4294967296)); fi
  printf '%s\n' "$wert"
}

_marker() {
  local nr=$1 titel=$2 status=$3 notiz=${4:-} anlage
  anlage=$(sql_text "SELECT $JETZT_SQL AS jetzt" 2>/dev/null | sed -n 2p || true)
  printf '| %s | %s | %s | %s | %s | %s |\n' "$nr" "$titel" "$status" "$(date '+%H:%M:%S')" "$anlage" "$notiz" \
    >>"$SCHRITTE_DATEI"
  mitschnitt_marker "schritt $nr $status anlage=$anlage"
}

# Fragt IDs aus Ausdrucken ab und sucht die Scheiben (ohne Namen).
_pdf_ids_abfragen() {
  local eingabe id auto_ids="${ERKUNDEN_AUTO_PDF_IDS:-}"
  {
    echo
    echo "IDs aus Ausdrucken:"
    echo
  } >>"$SCHRITTE_DATEI"
  while :; do
    if [ "$AUTO" = 1 ]; then
      eingabe=${auto_ids%% *}
      if [ "$eingabe" = "$auto_ids" ]; then auto_ids=""; else auto_ids=${auto_ids#* }; fi
    else
      read -r -p "ID aus dem Fuß des Ausdrucks (z. B. ff914420; leer = fertig): " eingabe
    fi
    [ -n "$eingabe" ] || break
    id=$(pdf_id_dekodieren "$eingabe")
    if [ -z "$id" ]; then
      warnung "Keine gültige ID (acht Hex-Zeichen): $eingabe"
      echo "- \`$eingabe\`: keine gültige ID" >>"$SCHRITTE_DATEI"
      continue
    fi
    {
      echo "- \`$eingabe\` → ScheibenID $id"
      echo
      sql_tabelle "SELECT ScheibenID, StandNr, DisziplinID, Disziplin, Status, Trefferzahl, TotalRing, TotalRing01, Zeitstempel
        FROM Scheiben WHERE ScheibenID = $id" | md_code
      echo
    } >>"$SCHRITTE_DATEI"
    info "ID $eingabe → ScheibenID $id (Ergebnis in schritte.md)"
  done
  echo >>"$SCHRITTE_DATEI"
}

# Nach jedem Schritt: Stand des Mitschnitts. Sieht er nach Schritt 1 noch nichts, laut warnen:
# Dann stimmen Uhr, Zeitzone oder die Einstellung des SSMDB2-Dienstes nicht.
_status_zeigen() {
  [ -n "$MITSCHNITT_PID" ] || return 0
  sleep 1
  if ! mitschnitt_status && [ "$1" -ge 1 ]; then
    printf '\033[31m!! Mitschnitt sieht keine Scheibe.\033[0m Prüfen: Dienst SSMDB2 im Kontrollzentrum auf Echtzeit?\n' >&2
    printf '   Uhr und Zeitzone der Anlage (umgebung.md)? Wurde wirklich auf einer Scheibe geschossen?\n' >&2
  fi
}

# Ein Schritt: Anweisung zeigen, auf den Schützen warten, Marker setzen.
# Rückgabe 1, wenn der User das Protokoll beenden will.
_schritt() {
  local nr=$1 titel=$2 anweisung=$3 ids=${4:-} antwort="" notiz=""
  echo >&2
  info "Schritt $nr: $titel"
  printf '%s\n' "$anweisung" | sed 's/^/    /' >&2
  if [ "$AUTO" = 1 ]; then
    case " ${ERKUNDEN_AUTO_UEBERSPRINGEN:-} " in *" $nr "*) antwort=s ;; esac
    if [ "$antwort" != s ] && [ -n "${ERKUNDEN_AUTO_HOOK:-}" ]; then
      "$ERKUNDEN_AUTO_HOOK" "$nr"
      sleep "${ERKUNDEN_AUTO_WARTEN:-3}"
    fi
  else
    read -r -p "    Enter = erledigt, s = überspringen, q = Protokoll beenden: " antwort
  fi
  case "$antwort" in
    q | Q)
      _marker "$nr" "$titel" "abgebrochen"
      return 1
      ;;
    s | S)
      _marker "$nr" "$titel" "übersprungen"
      return 0
      ;;
  esac
  if [ "$AUTO" = 0 ]; then
    read -r -p "    Notiz (optional, keine Namen; was ist aufgefallen?): " notiz
  fi
  _marker "$nr" "$titel" "erledigt" "$notiz"
  if [ "$ids" = ids ]; then _pdf_ids_abfragen; fi
  _status_zeigen "$nr"
  return 0
}

# Die Schritte. Wer die Anlage nicht umstellen kann, überspringt die optionalen mit "s".
protokoll_schiessen() {
  SCHRITTE_DATEI="$AUSGABE/bericht/schritte.md"
  {
    echo "# Schießprotokoll"
    echo
    echo "Stand: $(date '+%Y-%m-%d') (Mac). Zeiten: Mac und Anlage. Die Daten dazu stehen in protokoll.tsv."
    echo
    echo "| Schritt | Titel | Status | Mac | Anlage | Notiz |"
    echo "|---|---|---|---|---|---|"
  } >"$SCHRITTE_DATEI"

  _schritt 1 "Achsen und Latenz" \
"Neue Scheibe, Probe. Einen Probeschuss bewusst hoch rechts setzen (oben rechts außen).
Danach kurz warten (10 Sekunden), damit der Mitschnitt die Zeit bis zur neuen Zeile misst." || return 0
  _schritt 2 "Probe, Wertung, zurück auf Probe" \
"Auf derselben Scheibe: noch zwei Probe (zusammen drei), auf Wertung umschalten, zwei Wertung.
Dann zurück auf Probe schalten, falls die Anlage das erlaubt, zwei Probe, wieder Wertung, zwei Wertung.
Nach jedem Umschalten 10 Sekunden warten. Geht das Zurückschalten nicht, das als Notiz eintragen." || return 0
  _schritt 3 "Nur Probe" \
"Neue Scheibe: nur drei Probeschüsse, nicht auf Wertung schalten, Scheibe beenden." || return 0
  _schritt 4 "Abbruch" \
"Neue Scheibe: drei Wertungsschüsse (Probe darf vorher sein), dann die Scheibe vorzeitig beenden." || return 0
  _schritt 5 "Ohne Starter" \
"Neue Scheibe ohne gewählten Namen (frei zugewiesen), zwei Wertungsschüsse, ausdrucken.
Danach die ID aus dem Fuß des Ausdrucks eingeben (ID: xxxxxxxx)." ids || return 0
  _schritt 6 "Zwischen- und Doppelausdruck" \
"Neue Scheibe mit Namen: fünf Wertungsschüsse, ausdrucken; zwei weitere, ausdrucken; noch einmal ausdrucken.
Danach die IDs aller drei Ausdrucke nacheinander eingeben." ids || return 0
  _schritt 7 "Korrektur (optional)" \
"Wenn die Anlage es erlaubt: auf einer Scheibe dieses Abends einen Schuss löschen und einen Wert korrigieren.
In der Notiz festhalten, welcher Schuss (Nummer) und was geändert wurde." || return 0
  _schritt 8 "Lange Probe (optional)" \
"Neue Scheibe LP 40 (oder LG 40): 15 Probeschüsse, dann zwei Wertung. Was zeigt die Anlage als Schusszahl?" || return 0
  _schritt 9 "Falsche Disziplin (optional)" \
"Ein paar Schuss mit dem Luftgewehr auf einer Luftpistolen-Disziplin (oder umgekehrt)." || return 0
  _schritt 10 "Verdeckte Wertung (optional)" \
"Wenn einrichtbar: zwei Schuss in einer Disziplin mit verdeckter Wertung (Modus 10)." || return 0
  _schritt 11 "LG/LP Training Spiegel (optional)" \
"Falls es die Disziplin LG/LP Training Spiegel gibt: drei Schuss darauf." || return 0
  return 0
}
