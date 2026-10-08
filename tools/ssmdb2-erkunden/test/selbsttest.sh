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

anlage_starten() {
  docker network create "$NETZ" >/dev/null
  docker run -d --name "$ANLAGE" --network "$NETZ" \
    -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=SSMDB2 \
    -e MARIADB_USER="$ERKUNDEN_USER" -e MARIADB_PASSWORD="$ERKUNDEN_PASSWORT" \
    -v "$HIER/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro" \
    -v "$HIER/daten.sql:/docker-entrypoint-initdb.d/02-daten.sql:ro" \
    "$IMAGE" >/dev/null
  for _ in $(seq 1 60); do
    if docker exec "$ANLAGE" mariadb -u"$ERKUNDEN_USER" -p"$ERKUNDEN_PASSWORT" SSMDB2 \
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
  docker exec -i "$ANLAGE" mariadb -uroot -proot SSMDB2
}

erkunden() {
  bash "$WERKZEUG/erkunden.sh" --host "$ANLAGE" --docker --docker-netz "$NETZ" --auto \
    --ausgabe "$AUSGABE" "$@"
}

kein_testname_im_bericht() {
  ! grep -r -E 'Prüfling|Annegret|Zielwasser|Bertram|48151623' "$AUSGABE/bericht" >/dev/null
}

kein_passwort_in_ausgabe() {
  ! grep -r -F 'pass\wort' "$AUSGABE" >/dev/null
}

echo "Testanlage starten ($IMAGE)"
anlage_starten

erkunden selbsttest verbinden checkliste dump
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
  gunzip -c "$AUSGABE/privat/ssmdb2.sql.gz" | docker exec -i "$ANLAGE" mariadb -uroot -proot kopie || return 1
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
pruefe "kein Passwort in der Ausgabe" kein_passwort_in_ausgabe
pruefe "kein Testname im Bericht" kein_testname_im_bericht

if [ "$FEHLER" = 0 ]; then echo "Selbsttest bestanden"; else echo "Selbsttest NICHT bestanden"; exit 1; fi
