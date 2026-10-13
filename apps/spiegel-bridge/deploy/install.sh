#!/bin/sh
# Installiert die Spiegel-Brücke auf Linux mit systemd (Raspberry Pi OS, Debian, SUSE):
#   sudo sh install.sh ./spiegel-bridge-linux-arm64
# Danach koppeln (der Zugang zur SSMDB2 wird abgefragt, damit das Passwort nicht in der Befehlszeile steht):
#   sudo -u spiegel-bridge /usr/local/bin/spiegel-bridge pair --url https://spiegel.example --code ABCDE-FGHJK
#   sudo systemctl enable --now spiegel-bridge
# Wiederholbar: ein zweiter Lauf ersetzt nur Binary und Dienst; die Konfiguration bleibt.
set -eu

binary=${1:-}
if [ -z "$binary" ] || [ ! -f "$binary" ]; then
	echo "Aufruf: sudo sh install.sh <spiegel-bridge-Binary>" >&2
	exit 2
fi
if [ "$(id -u)" -ne 0 ]; then
	echo "install.sh braucht root (sudo)" >&2
	exit 2
fi
here=$(dirname "$0")

install -m 0755 "$binary" /usr/local/bin/spiegel-bridge
if ! id spiegel-bridge >/dev/null 2>&1; then
	nologin=$(command -v nologin || echo /bin/false)
	useradd --system --no-create-home --home-dir /nonexistent --shell "$nologin" spiegel-bridge
fi
# nur der Dienst liest die Konfiguration (Token und Zugang zur SSMDB2)
install -d -m 0700 -o spiegel-bridge -g spiegel-bridge /etc/spiegel-bridge
if [ -d /etc/systemd/system ]; then
	install -m 0644 "$here/spiegel-bridge.service" /etc/systemd/system/spiegel-bridge.service
	if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
		systemctl daemon-reload
	fi
fi
echo "installiert: $(/usr/local/bin/spiegel-bridge version)"
if [ ! -f /etc/spiegel-bridge/config.json ]; then
	echo "jetzt koppeln: sudo -u spiegel-bridge /usr/local/bin/spiegel-bridge pair --url <Spiegel> --code <Code>"
	echo "dann starten:  sudo systemctl enable --now spiegel-bridge"
fi
