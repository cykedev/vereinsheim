#!/usr/bin/env bash
# Übernahme aus Treffsicher gegen den Teststack, so wie auf dem VPS: `vereinsheim transfer` ohne .vereinsheim.local
# (VPS-Modus), Treffsicher über psql auf dem Host, das Konto per Pipe in den Dienst transfer-spiegel aus dem echten
# Image. Ein erfundenes Konto e2e@example.invalid mit einer Einheit ohne Disziplin; Probelauf, echter Lauf, zweiter Lauf,
# Merkmal aufheben, unbekanntes Konto.
# Läuft aus tools/stack-e2e/run.sh --transfer, das ENV_FILE, COMPOSE_PROJECT_NAME und COMPOSE_FILE setzt. Berichte
# landen in einem eigenen Temp-Ordner (TRANSFER_REPORTS), nicht unter reports/.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2

: "${ENV_FILE:?aus tools/stack-e2e/run.sh --transfer aufrufen}"
: "${COMPOSE_PROJECT_NAME:?aus tools/stack-e2e/run.sh --transfer aufrufen}"
# legt Konten in Treffsicher an: nie gegen einen anderen Stack (etwa den lokalen mit Produktionsdaten)
if [[ "$COMPOSE_PROJECT_NAME" != "vereinsheim-e2e" ]]; then
	echo "transfer.sh läuft nur gegen das Projekt vereinsheim-e2e, nicht gegen $COMPOSE_PROJECT_NAME." >&2
	exit 2
fi
if [[ -f .vereinsheim.local ]]; then
	echo "transfer.sh prüft den VPS-Modus des CLI und braucht ein Repo ohne .vereinsheim.local (etwa einen Worktree)." >&2
	exit 2
fi
WORK="$(mktemp -d)"
export TRANSFER_REPORTS="$WORK/reports" VEREINSHEIM_ENV_FILE="$ENV_FILE"
trap 'rm -rf "$WORK"' EXIT

EMAIL=e2e@example.invalid
compose() { docker compose --env-file "$ENV_FILE" "$@"; }
psql_db() { compose exec -T db psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -At; }
runs() { echo "select count(*) from \"TransferRun\" r join \"User\" u on u.id = r.\"userId\" where u.email = '$EMAIL';" | psql_db spiegel; }
moved() { echo "select coalesce(\"movedToSpiegelAt\"::text, 'NULL') from \"User\" where email = '$EMAIL';" | psql_db treffsicher; }
cli() { ./scripts/vereinsheim transfer "$@"; }

PROBLEMS=()
problem() {
	PROBLEMS+=("$1")
	echo "  FEHLER: $1"
}
# Befehl ausführen, Ausgabe ohne Farben sichern, Exit-Code zurückgeben
run() {
	"$@" >"$WORK/out.txt" 2>&1
	local rc=$?
	sed 's/\x1b\[[0-9;]*m//g' "$WORK/out.txt" >"$WORK/plain.txt"
	return "$rc"
}
expect_exit() {
	local want="$1" got="$2" what="$3"
	if [[ "$got" == "$want" ]]; then
		echo "  $what: Exit $got"
	else
		problem "$what: Exit $got statt $want"
		tail -15 "$WORK/plain.txt"
	fi
}
peak() { grep -o 'Speicher: Spitze [0-9]* MiB' "$WORK/plain.txt" | tail -1; }

echo "==> Erfundenes Konto in Treffsicher"
psql_db treffsicher >/dev/null <<SQL
insert into "User" ("id", "name", "email", "passwordHash", "updatedAt")
values ('e2etransferuser', 'Erfunden', '$EMAIL', '\$2b\$10\$erfundenerHashDerNieZuEinemPasswortPasst000000000000', now());
insert into "TrainingSession" ("id", "userId", "type", "date", "trainingGoal", "updatedAt")
values ('e2etransfersession', 'e2etransferuser', 'TRAINING', '2026-10-01 18:00', 'Abzug ruhig', now());
SQL

echo "==> Probelauf"
rc=0
run cli --from "$EMAIL" --to "$EMAIL" --dry-run || rc=$?
expect_exit 0 "$rc" "Probelauf"
echo "  $(peak)"
[[ "$(moved)" == "NULL" ]] || problem "Probelauf hat das Merkmal gesetzt"
[[ "$(runs)" == "0" ]] || problem "Probelauf hat einen Lauf gespeichert"

echo "==> Echter Lauf"
rc=0
run cli --yes --from "$EMAIL" --to "$EMAIL" || rc=$?
expect_exit 0 "$rc" "echter Lauf"
echo "  $(peak)"
[[ "$(runs)" == "1" ]] || problem "nach dem echten Lauf $(runs) Läufe statt 1"
[[ "$(moved)" != "NULL" ]] || problem "Merkmal nach dem echten Lauf nicht gesetzt"
reports=("$TRANSFER_REPORTS"/transfer-*.md)
if [[ -f "${reports[0]}" ]]; then
	mode="$(stat -c '%a' "${reports[0]}" 2>/dev/null || stat -f '%Lp' "${reports[0]}")"
	[[ "$mode" == "600" ]] || problem "Bericht mit Modus $mode statt 600"
	echo "  Bericht da, Modus $mode"
else
	problem "kein Bericht unter TRANSFER_REPORTS"
fi
leftovers=("$TRANSFER_REPORTS"/.lauf-*)
[[ ! -e "${leftovers[0]}" ]] || problem "Arbeitsordner .lauf-* nicht aufgeräumt"
grep -q "$EMAIL" "$WORK/plain.txt" && problem "die Ausgabe nennt die E-Mail"

echo "==> Zweiter Lauf"
rc=0
run cli --yes --from "$EMAIL" --to "$EMAIL" || rc=$?
expect_exit 0 "$rc" "zweiter Lauf"
[[ "$(runs)" == "2" ]] || problem "nach dem zweiten Lauf $(runs) Läufe statt 2"

echo "==> Merkmal aufheben"
rc=0
run cli mark --yes --clear --from "$EMAIL" || rc=$?
expect_exit 0 "$rc" "mark --clear"
[[ "$(moved)" == "NULL" ]] || problem "Merkmal nach mark --clear noch gesetzt"

echo "==> Unbekanntes Konto"
rc=0
run cli --yes --from nobody@example.invalid --to nobody@example.invalid || rc=$?
expect_exit 3 "$rc" "unbekanntes Konto"
grep -q "Kein Konto in Treffsicher" "$WORK/plain.txt" || problem "unbekanntes Konto ohne Meldung"

echo
if [[ ${#PROBLEMS[@]} -eq 0 ]]; then
	echo "Übernahme gegen den Teststack: in Ordnung."
else
	echo "Übernahme gegen den Teststack: ${#PROBLEMS[@]} Fehler:"
	printf '  - %s\n' "${PROBLEMS[@]}"
	exit 1
fi
