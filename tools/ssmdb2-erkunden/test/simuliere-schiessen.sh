#!/usr/bin/env bash
# Simuliert für den Selbsttest das Schießen eines Protokollschritts in der Testanlage (als root; das
# Werkzeug selbst schreibt nie). Aufruf: simuliere-schiessen.sh <schritt>. Container in $ANLAGE.
# Schritt 2 verhält sich wie die ungünstige Lesart von SF-03: die Probe verschwindet mit der Wertung.
set -euo pipefail

: "${ANLAGE:?ANLAGE fehlt}"
# Versatz der Zeitstempel gegen die Server-Uhr in Stunden (Zeitzonen-Durcheinander, SF-29/SF-31).
ZEIT="NOW() + INTERVAL ${SIM_VERSATZ_STUNDEN:-0} HOUR"

sql() {
  docker exec -i "$ANLAGE" mariadb --skip-ssl -uroot -proot SSMDB2
}

scheibe() { # id nachname disziplin_id disziplin
  sql <<EOF
INSERT INTO Scheiben (ScheibenID, Starterliste, StarterlisteID, Startzeit, StartNr, Nachname, Vorname, SportpassID,
  StandNr, StandNrText, Disziplin, DisziplinID, Status, Trefferzahl, TotalRing, TotalRing01, BesterTeiler01,
  BesterTeiler001, Zeitstempel)
VALUES ($1, 'Training', 1, '0000-00-00 00:00:00', 0, '$2', 'Annegret', IF('$2' = '--frei--', 0, 48151623),
  4, '4', '$4', $3, '1', 0, 0, 0, 0, 0, $ZEIT);
EOF
}

schuss() { # id stellung nr x y ring01
  sql <<EOF
INSERT INTO Treffer VALUES ($1, $2, $3, IF($2 = 0, 0, 1), $4, $5, 0, 1, '', FLOOR($6 / 10), $6,
  ROUND(SQRT($4 * $4 + $5 * $5) / 10), ROUND(SQRT($4 * $4 + $5 * $5)), $ZEIT, FLOOR(RAND() * 1000));
UPDATE Scheiben SET Zeitstempel = $ZEIT,
  Trefferzahl = (SELECT COUNT(*) FROM Treffer WHERE ScheibenID = $1 AND Stellung > 0) WHERE ScheibenID = $1;
EOF
}

case "$1" in
  1)
    scheibe 1001 'Prüfling' 10100040 'LG 40 Schuss'
    schuss 1001 0 1 300 400 87
    ;;
  2)
    schuss 1001 0 2 -50 20 103
    schuss 1001 0 3 10 -30 104
    sleep 2
    schuss 1001 1 1 15 25 105
    # ungünstige Lesart von SF-03: mit dem ersten Wertungsschuss verschwindet die Probe
    echo "DELETE FROM Treffer WHERE ScheibenID = 1001 AND Stellung = 0" | sql
    schuss 1001 1 2 -40 5 102
    sleep 2
    schuss 1001 0 4 20 20 104
    schuss 1001 0 5 -10 10 106
    sleep 2
    schuss 1001 1 3 30 -60 100
    schuss 1001 1 4 0 15 107
    ;;
  3)
    scheibe 1003 'Zielwasser' 10200040 'LP 40 Schuss'
    schuss 1003 0 1 100 -50 90
    schuss 1003 0 2 -80 60 88
    schuss 1003 0 3 40 40 95
    ;;
  4)
    scheibe 1004 'Prüfling' 10100040 'LG 40 Schuss'
    schuss 1004 1 1 20 10 106
    schuss 1004 1 2 -60 30 101
    schuss 1004 1 3 5 -5 108
    ;;
  5)
    scheibe 1005 '--frei--' 10100000 'LG Training'
    schuss 1005 1 1 25 -25 104
    schuss 1005 1 2 -15 45 102
    ;;
  6)
    scheibe -7300000 'Prüfling' 10100040 'LG 40 Schuss'
    for nr in 1 2 3 4 5; do schuss -7300000 1 "$nr" $((nr * 10)) $((nr * -7)) 100; done
    ;;
  *) ;;
esac
