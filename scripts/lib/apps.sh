# Apps des Stacks, an einer Stelle für das CLI und die Skripte. Eine neue App trägt man in APPS, DATA_APPS und CODE_APPS
# ein (mit Upload-Volume auch in UPLOAD_APPS), dazu in compose.yml, Caddyfile, .env.example und db-init/. Treffsicher läuft
# nicht mehr und hat keinen Code mehr im Repo ([[adr-033]], Stufen 4 und 5): Seine Datenbank und Anhänge bleiben bis zum
# Löschtermin am 1. Februar 2027.
# shellcheck disable=SC2034 # genutzt von den Skripten, die diese Datei einbinden
# Apps, die laufen: in dieser Reihenfolge gebaut, deployt, im Status und in den Logs
APPS=(ringwerk spiegel)
# Datenbanken, die gesichert werden: Backup, Restore, Restore-Probe, db-ensure
DATA_APPS=(ringwerk treffsicher spiegel)
# Der Code im Repo, für das Konsistenz-Gate und dev-setup. Treffsicher hat seit Stufe 5 keinen Code mehr, nur noch
# Datenbank und Anhänge bis zum Löschtermin.
CODE_APPS=(ringwerk spiegel)
# Treffsicher (Anhänge) und Spiegel (Ausdrucke) haben ein Upload-Volume
UPLOAD_APPS=(treffsicher spiegel)

# in_list <wert> <liste…>: steht der Wert in der Liste?
in_list() {
	local value="$1" item
	shift
	for item in "$@"; do
		[[ "$value" == "$item" ]] && return 0
	done
	return 1
}
