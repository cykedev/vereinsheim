# Apps des Stacks, an einer Stelle für das CLI und die Skripte: in dieser Reihenfolge deployt,
# gesichert und geprüft. Eine neue App trägt man hier ein, dazu in compose.yml, Caddyfile, .env.example und db-init/.
# shellcheck disable=SC2034 # genutzt von den Skripten, die diese Datei einbinden
APPS=(ringwerk treffsicher spiegel)
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
