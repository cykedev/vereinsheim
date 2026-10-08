#!/usr/bin/env bash
# Selbsttest: startet eine nachgebaute SSMDB2 (mariadb:11) und lässt erkunden.sh dagegen laufen.
# Exit 0 nur, wenn alle Prüfungen bestehen. Räumt Container und Netz immer ab.
set -euo pipefail

HIER=$(cd "$(dirname "$0")" && pwd)
WERKZEUG="$HIER/.."
IMAGE="${ERKUNDEN_DOCKER_IMAGE:-mariadb:11}"
NETZ="ssmdb2-test-$$"
ANLAGE="ssmdb2-testanlage-$$"
AUSGABE=$(mktemp -d "${TMPDIR:-/tmp}/ssmdb2-selbsttest.XXXXXX")
INIT="$AUSGABE/init"
ZUGAENGE_VORHER=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'ssmdb2-zugang.*' 2>/dev/null | wc -l | tr -d ' ')
export ERKUNDEN_USER=meyton
export ERKUNDEN_PASSWORT='test"pass\wort'
FEHLER=0

aufraeumen() {
  docker rm -f "$ANLAGE" >/dev/null 2>&1 || true
  docker network rm "$NETZ" >/dev/null 2>&1 || true
  if [ "${BEHALTEN:-0}" = 1 ]; then echo "Ausgabe behalten: $AUSGABE"; else rm -rf "$AUSGABE"; fi
}
trap aufraeumen EXIT

pruefe() {
  local beschreibung=$1
  shift
  if "$@"; then
    echo "ok    $beschreibung"
  else
    echo "FEHLT $beschreibung"
    FEHLER=1
  fi
}

# Init-Skripte: zwei Datenbanken und ein Benutzer, der NUR lesen darf (wie vermutlich der
# Standard-Zugang). SSMDB2 wie die Anlage, SSMDB2ALT mit anderem Schema: Tabellen klein
# geschrieben, keine Tabelle Version, eine Spalte Name, eine View (der Dump darf daran nicht abbrechen).
init_schreiben() {
  local passwort_sql
  passwort_sql=$(printf '%s' "$ERKUNDEN_PASSWORT" | sed -e 's/\\/\\\\/g' -e "s/'/''/g")
  mkdir -p "$INIT"
  cat >"$INIT/00-benutzer.sql" <<SQL
CREATE DATABASE SSMDB2;
CREATE DATABASE SSMDB2ALT;
CREATE USER '$ERKUNDEN_USER'@'%' IDENTIFIED BY '$passwort_sql';
GRANT SELECT ON SSMDB2.* TO '$ERKUNDEN_USER'@'%';
GRANT SELECT ON SSMDB2ALT.* TO '$ERKUNDEN_USER'@'%';
SQL
  { echo "USE SSMDB2;"; cat "$HIER/schema.sql"; } >"$INIT/01-schema.sql"
  { echo "USE SSMDB2;"; cat "$HIER/daten.sql"; } >"$INIT/02-daten.sql"
  cat >"$INIT/03-anders.sql" <<'SQL'
USE SSMDB2ALT;
CREATE TABLE scheiben (ScheibenID int(11) NOT NULL PRIMARY KEY, Name varchar(30), zeitstempel datetime) ENGINE=MyISAM;
CREATE TABLE treffer (ScheibenID int(11) NOT NULL, Nr int(11) NOT NULL, x int(11), y int(11), PRIMARY KEY (ScheibenID, Nr)) ENGINE=MyISAM;
CREATE VIEW v_scheiben AS SELECT ScheibenID FROM scheiben;
INSERT INTO scheiben VALUES (1, 'Geheimname Mustermensch', NOW());
INSERT INTO treffer VALUES (1, 1, 5, 5);
SQL
}

anlage_starten() {
  init_schreiben
  docker network create "$NETZ" >/dev/null
  # --skip-ssl: der Server spricht kein TLS, wie vermutlich das MariaDB auf dem Meyton-Rechner (Review B1).
  docker run -d --name "$ANLAGE" --network "$NETZ" -e MARIADB_ROOT_PASSWORD=root \
    -v "$INIT:/docker-entrypoint-initdb.d:ro" "$IMAGE" --skip-ssl >/dev/null
  for _ in $(seq 1 60); do
    if docker exec "$ANLAGE" mariadb --skip-ssl -u"$ERKUNDEN_USER" -p"$ERKUNDEN_PASSWORT" SSMDB2 \
      -e "SELECT COUNT(*) FROM Treffer" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Testanlage startet nicht" >&2
  docker logs "$ANLAGE" | tail -20 >&2
  return 1
}

# Schreibt SQL in die Testanlage (als root; das Werkzeug selbst schreibt nie).
anlage_sql() {
  docker exec -i "$ANLAGE" mariadb --skip-ssl -uroot -proot SSMDB2
}

erkunden() {
  "${ERKUNDEN_BASH:-bash}" "$WERKZEUG/erkunden.sh" --host "$ANLAGE" --docker --docker-netz "$NETZ" --auto \
    --ausgabe "${ZIEL:-$AUSGABE}" "$@"
}

kein_testname_im_bericht() {
  ! grep -r -E 'Prüfling|Annegret|Zielwasser|Bertram|48151623' "$AUSGABE/bericht" >/dev/null
}

kein_passwort_in_ausgabe() {
  ! grep -r -F 'pass\wort' "$AUSGABE" >/dev/null
}

echo "Testanlage starten ($IMAGE)"
anlage_starten

erkunden selbsttest verbinden checkliste dump || echo "Erster Lauf mit Exit $?" >&2
pruefe "umgebung.md geschrieben" test -s "$AUSGABE/bericht/umgebung.md"
pruefe "Server-Version im Bericht" grep -q "MariaDB" "$AUSGABE/bericht/umgebung.md"
pruefe "Tabelle Version gelesen" grep -q "6.0.2" "$AUSGABE/bericht/umgebung.md"
pruefe "Uhrabweichung berechnet" grep -q "Uhr der Anlage minus Uhr des Macs" "$AUSGABE/bericht/umgebung.md"
pruefe "Sitzung read-only" grep -q "Read-only laut Server: 1" "$AUSGABE/bericht/umgebung.md"
ANTWORTEN="$AUSGABE/bericht/antworten.md"
pruefe "antworten.md geschrieben" test -s "$ANTWORTEN"
pruefe "alle zehn Themen im Bericht" test "$(grep -c '^## [0-9][0-9]-' "$ANTWORTEN")" = 10
pruefe "keine SQL-Fehler gegen die Testanlage" sh -c "! grep -q '^ERROR' '$ANTWORTEN'"
pruefe "Skalen-Abfrage gelaufen" grep -q "ring01_gleich_summe" "$ANTWORTEN"
pruefe "Handeintrag gefunden" grep -q "Hand" "$ANTWORTEN"
# Die Kopie muss sich einspielen lassen und dieselben Zeilen haben.
dump_einspielbar() {
  local tabelle a b
  echo "CREATE DATABASE kopie" | anlage_sql
  gunzip -c "$AUSGABE/privat/ssmdb2.sql.gz" | docker exec -i "$ANLAGE" mariadb --skip-ssl -uroot -proot kopie || return 1
  for tabelle in Version Scheiben Serien Treffer; do
    a=$(echo "SELECT COUNT(*) FROM SSMDB2.$tabelle" | anlage_sql | sed -n 2p)
    b=$(echo "SELECT COUNT(*) FROM kopie.$tabelle" | anlage_sql | sed -n 2p)
    [ "$a" = "$b" ] || { echo "  $tabelle: $a gegen $b" >&2; return 1; }
  done
}
pruefe "Kopie in privat/ geschrieben" test -s "$AUSGABE/privat/ssmdb2.sql.gz"
pruefe "privat/ nur für den Besitzer" sh -c "ls -ld '$AUSGABE/privat' | grep -q '^drwx------'"
pruefe "Kopie einspielbar mit gleichen Zeilen" dump_einspielbar
pruefe "Schema ohne Daten im Bericht" sh -c "grep -q 'CREATE TABLE \`Treffer\`' '$AUSGABE/bericht/schema.sql' && ! grep -q 'INSERT' '$AUSGABE/bericht/schema.sql'"
pruefe "Zeilenzahlen in dump.md" grep -q "Treffer: 6" "$AUSGABE/bericht/dump.md"
# Zweiter Aufruf in denselben Ausgabeordner: das Protokoll verändert die Testanlage.
export ANLAGE
export ERKUNDEN_AUTO_HOOK="$HIER/simuliere-schiessen.sh"
export ERKUNDEN_AUTO_UEBERSPRINGEN="7 8 9 10 11"
export ERKUNDEN_AUTO_PDF_IDS="ff914420 kaputt"
export ERKUNDEN_AUTO_WARTEN=3
# Zeitstempel zwei Stunden hinter der Server-Uhr (Zeitzonen-Durcheinander, Review B2, SF-29/SF-31).
export SIM_VERSATZ_STUNDEN=-2
erkunden protokoll abschluss 2>"$AUSGABE/protokoll-stderr.txt" || echo "Protokoll-Lauf mit Exit $?" >&2

# Im Protokoll muss die Probe von 1001 erst da sein und später fehlen, während Wertung da ist (SF-03).
probe_verschwindet() {
  awk -F'\t' '
    /^# stand/ { if (w && !p && sah_probe) weg = 1; if (p) sah_probe = 1; p = 0; w = 0; abschnitt = ""; next }
    /^#Treffer/ { abschnitt = "treffer"; next }
    /^#/ { abschnitt = ""; next }
    abschnitt == "treffer" && $1 == "1001" && $2 == "0" { p = 1 }
    abschnitt == "treffer" && $1 == "1001" && $2 == "1" { w = 1 }
    END { if (w && !p && sah_probe) weg = 1; exit !weg }
  ' "$AUSGABE/bericht/protokoll.tsv"
}
SCHRITTE="$AUSGABE/bericht/schritte.md"
PROTOKOLL="$AUSGABE/bericht/protokoll.tsv"
pruefe "schritte.md mit allen elf Schritten" test "$(grep -c '^| [0-9]' "$SCHRITTE")" = 11
pruefe "Schritte 7 bis 11 übersprungen" test "$(grep -c '| übersprungen |' "$SCHRITTE")" = 5
pruefe "PDF-ID ff914420 als -7257056 gefunden" grep -q 'ff914420` → ScheibenID -7257056' "$SCHRITTE"
pruefe "Scheibe zur PDF-ID nachgeschlagen" grep -q -E '^\| +-7257056 \| +4 \|' "$SCHRITTE"
pruefe "Live-Status nach den Schritten" grep -q 'Mitschnitt: [1-9][0-9]* Stände' "$AUSGABE/protokoll-stderr.txt"
pruefe "keine Warnung, dass der Mitschnitt nichts sieht" sh -c "! grep -q 'sieht keine Scheibe' '$AUSGABE/protokoll-stderr.txt'"
pruefe "ungültige ID gemeldet" grep -q 'kaputt`: keine gültige ID' "$SCHRITTE"
pruefe "Protokoll mit Ständen" grep -q '^# stand mac_ms=' "$PROTOKOLL"
pruefe "Grundlast gemessen" grep -q '^# start seit=.* basis_ms=[0-9]' "$PROTOKOLL"
pruefe "Takt nicht wegen Client-Aufwand verlangsamt" sh -c "! grep -q '^# takt' '$PROTOKOLL'"
pruefe "Marker der Schritte im Protokoll" grep -q '^# schritt 2 erledigt' "$PROTOKOLL"
pruefe "Scheiben aus Schritt 3 bis 6 mitgeschnitten" sh -c "grep -q '^1003	' '$PROTOKOLL' && grep -q '^1004	' '$PROTOKOLL' && grep -q '^1005	' '$PROTOKOLL' && grep -q '^-7300000	' '$PROTOKOLL'"
pruefe "verschwindende Probe sichtbar (SF-03)" probe_verschwindet
pruefe "Namen im Rohprotokoll (privat)" grep -q 'Prüfling' "$AUSGABE/privat/protokoll-roh.tsv"
pruefe "Pseudonyme im Bericht" grep -q '	P1	' "$PROTOKOLL"
pruefe "--frei-- bleibt stehen" grep -q '	--frei--	' "$PROTOKOLL"
pruefe "zweite Checkliste geschrieben" test -s "$AUSGABE/bericht/antworten-danach.md"
pruefe "LIESMICH mit Namensprüfung ohne Treffer" grep -q "Namensprüfung: keine Treffer" "$AUSGABE/bericht/LIESMICH.md"
pruefe "Namensliste wieder gelöscht" sh -c "! ls '$AUSGABE/privat/' | grep -q namen"
pruefe "kein Passwort in der Ausgabe" kein_passwort_in_ausgabe
pruefe "kein Testname im Bericht" kein_testname_im_bericht

# Anderes Schema (Review B3, S1): Der Lauf bricht nicht ab, meldet Lücken und gibt keine Entwarnung.
ANDERS="$AUSGABE/anders"
if ZIEL="$ANDERS" erkunden --db SSMDB2ALT verbinden checkliste dump abschluss 2>/dev/null; then
  RC_ANDERS=0
else
  RC_ANDERS=$?
fi
pruefe "anders: Lauf ohne Abbruch (Exit 0)" test "$RC_ANDERS" = 0
pruefe "anders: umgebung.md vollständig" grep -q "## Netz" "$ANDERS/bericht/umgebung.md"
pruefe "anders: alle zehn Themen" test "$(grep -c '^## [0-9][0-9]-' "$ANDERS/bericht/antworten.md")" = 10
pruefe "anders: Kopie als unvollständig gemeldet" grep -q "unvollständig" "$ANDERS/bericht/dump.md"
pruefe "anders: Namensprüfung nicht möglich" grep -q "Namensprüfung nicht möglich" "$ANDERS/bericht/LIESMICH.md"
pruefe "anders: keine Entwarnung im LIESMICH" sh -c "! grep -q 'enthält keine Namen' '$ANDERS/bericht/LIESMICH.md'"
pruefe "anders: kein Name im Bericht" sh -c "! grep -r -q 'Geheimname' '$ANDERS/bericht'"

# Interaktiver Pfad, wie am Abend: Antworten über stdin statt --auto. Der Mitschnitt läuft dabei
# im Hintergrund und darf keine Eingaben verbrauchen (docker exec -i hatte das getan).
INTERAKTIV="$AUSGABE/interaktiv"
printf '%s\n' "$ERKUNDEN_USER" "$ERKUNDEN_PASSWORT" j '' 'Achse oben rechts positiv' s '' '' '' '' '' '' \
  'ID: FF914420' '' q n |
  env -u ERKUNDEN_USER -u ERKUNDEN_PASSWORT -u ERKUNDEN_AUTO_HOOK "${ERKUNDEN_BASH:-bash}" "$WERKZEUG/erkunden.sh" \
    --host "$ANLAGE" --docker --docker-netz "$NETZ" --ausgabe "$INTERAKTIV" verbinden protokoll abschluss \
    >/dev/null 2>&1 || true
pruefe "interaktiv: Protokoll gestartet" test -s "$INTERAKTIV/bericht/schritte.md"
pruefe "interaktiv: Notiz zu Schritt 1" grep -q '| 1 | Achsen und Latenz | erledigt | .* | Achse oben rechts positiv |' "$INTERAKTIV/bericht/schritte.md"
pruefe "interaktiv: Schritt 2 übersprungen" grep -q '| 2 | .* | übersprungen |' "$INTERAKTIV/bericht/schritte.md"
pruefe "interaktiv: ID wie gedruckt (ID: FF914420) erkannt" grep -q '→ ScheibenID -7257056' "$INTERAKTIV/bericht/schritte.md"
pruefe "interaktiv: q beendet bei Schritt 6" grep -q '| 6 | .* | abgebrochen |' "$INTERAKTIV/bericht/schritte.md"
pruefe "interaktiv: keine Schritte nach dem Abbruch" sh -c "! grep -q '^| 7 ' '$INTERAKTIV/bericht/schritte.md'"
pruefe "interaktiv: LIESMICH geschrieben" test -s "$INTERAKTIV/bericht/LIESMICH.md"

ZUGAENGE_NACHHER=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'ssmdb2-zugang.*' 2>/dev/null | wc -l | tr -d ' ')
pruefe "Zugangsdateien nach jedem Lauf gelöscht" test "$ZUGAENGE_NACHHER" = "$ZUGAENGE_VORHER"

if [ "$FEHLER" = 0 ]; then echo "Selbsttest bestanden"; else echo "Selbsttest NICHT bestanden"; exit 1; fi
