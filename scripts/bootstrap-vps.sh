#!/usr/bin/env bash
# bootstrap-vps.sh — One-shot initial setup für einen frischen Debian/Ubuntu VPS.
#
# AUSFÜHRUNG: als root, vor jedem anderen Setup-Schritt.
#
# WAS DIESES SKRIPT MACHT
#   1) apt update + upgrade
#   2) Pakete: ufw, ca-certificates, curl, git, gnupg
#   3) UFW: nur 22/80/443 freigeben
#   4) Docker Engine + compose-plugin via offiziellem Skript installieren
#   5) Deploy-User anlegen (sudo, docker-Group), SSH-Key hinterlegen
#   6) Repo nach /home/<user>/vereinsheim klonen
#
# WAS ES *NICHT* MACHT
#   - SSH-Hardening (root-Login deaktivieren) → mache ich nicht ohne dich,
#     damit du dich bei einem Fehler nicht aussperrst.
#   - .env aufsetzen → läuft anschließend per `./scripts/vereinsheim setup`
#     als deploy-User.
#
# AUFRUF
#   ssh root@<vps>
#   curl -fsSL https://raw.githubusercontent.com/<user>/vereinsheim/main/scripts/bootstrap-vps.sh \
#     | bash -s -- "<ssh-public-key>" "<vereinsheim-repo-url>"
#
#   Beispiel:
#   bash bootstrap-vps.sh \
#     "ssh-ed25519 AAAA... christian@workstation" \
#     "https://github.com/cykedev/vereinsheim.git"
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
	echo "Dieses Skript muss als root laufen." >&2
	exit 1
fi

if [[ $# -lt 2 ]]; then
	cat <<-EOF >&2
		Usage: $0 "<ssh-public-key>" "<vereinsheim-repo-url>" [deploy-user]

		Beispiel:
		  $0 "ssh-ed25519 AAAA... christian@workstation" \\
		     "https://github.com/cykedev/vereinsheim.git"
	EOF
	exit 1
fi

SSH_PUBKEY="$1"
REPO_URL="$2"
DEPLOY_USER="${3:-deploy}"

echo "==> apt update + upgrade"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> install base packages"
apt-get install -y \
	ca-certificates curl git gnupg ufw

echo "==> configure ufw (22/80/443)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> install docker"
if ! command -v docker >/dev/null 2>&1; then
	curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo "==> create deploy user '$DEPLOY_USER'"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
	adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo,docker "$DEPLOY_USER"

# Sudo ohne Passwort für Backup-Verzeichnis-Setup etc. — bewusst nicht NOPASSWD:ALL,
# damit Eskalationen explizit bleiben. Aktuell: kein NOPASSWD, User nutzt sudo mit Passwort.

echo "==> install ssh authorized_keys"
SSH_DIR="/home/$DEPLOY_USER/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
echo "$SSH_PUBKEY" >>"$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR"

echo "==> create backup directory /var/backups/vereinsheim (owned by $DEPLOY_USER)"
mkdir -p /var/backups/vereinsheim
chown "$DEPLOY_USER:$DEPLOY_USER" /var/backups/vereinsheim

echo "==> clone vereinsheim repo"
REPO_DIR="/home/$DEPLOY_USER/vereinsheim"
if [[ ! -d "$REPO_DIR/.git" ]]; then
	sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$REPO_DIR"
else
	echo "    (existiert schon — git pull)"
	sudo -u "$DEPLOY_USER" git -C "$REPO_DIR" pull --ff-only
fi

cat <<-EOF

	${0##*/} done.

	Nächste Schritte:
	  1) Login als deploy-User testen:
	       ssh ${DEPLOY_USER}@<this-vps>
	  2) (Optional, empfohlen) root-Login per SSH deaktivieren:
	       sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
	       sudo systemctl reload ssh
	  3) Als deploy-User in den Repo wechseln und .env aufsetzen:
	       cd ~/vereinsheim
	       ./scripts/vereinsheim setup
	  4) Bilder bauen (lokal, aus dem vereinsheim-Repo):
	       DOCKER_USER=<docker-hub-user> ./scripts/build-and-push.sh
	  5) Deploy:
	       ./scripts/vereinsheim deploy
	  6) Backup-Cron:
	       ./scripts/vereinsheim cron

EOF
