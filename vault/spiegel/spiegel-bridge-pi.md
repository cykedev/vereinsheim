---
id: spiegel-bridge-pi
type: operation
title: "Spiegel — Brücke auf dem Raspberry Pi einrichten und aktualisieren"
aliases: [brücke-einrichten, bridge-pi, pi-setup, brücke-aktualisieren]
keywords: [raspberry pi 3 b+, raspberry pi os lite, imager, 64-bit, arm64, aarch64, dhcp, mdns, avahi, .local, ssh, hostname, scp, install.sh, systemd, journalctl, timedatectl, ntp, fake-hwclock, systemd-time-wait-sync, zeitsynchronisierung, echtzeituhr, kopplung, pair, update, aktualisieren, rückfall, rollback, unattended-upgrades, tailscale, fernwartung, dhcp-reservierung, dauerbetrieb, watchdog, sd_notify, type=notify, gotraceback, automatic-reboot, neustart, reboot, absturz, hänger, sommerpause, login-benutzer]
operation_of: ["[[spiegel-bridge]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[spiegel-ingest-pipeline]]", "[[meyton-ssmdb2]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Die Brücke läuft auf einem Raspberry Pi 3 B+ mit Raspberry Pi OS Lite **64-Bit**. Die Karte entsteht im
Imager mit Hostname `spiegel-bridge` und SSH-Schlüssel. Zu Hause wird aktualisiert, die Zeitsynchronisierung erzwungen,
mit `install.sh` installiert und mit Spiegel verbunden. Danach kommt der Pi ins Gerätenetz. Er bekommt seine Adresse per DHCP und
ist dort unter `spiegel-bridge.local` erreichbar. Updates spielt man von Hand vor Ort ein, ein Selbst-Update ist
zurückgestellt (User, 15. Oktober 2026). Der Pi darf dauerhaft laufen, auch wochenlang ohne Meyton-Anlage; systemd
startet die Brücke nach einem Absturz oder Hänger neu, und das Betriebssystem startet nachts neu, wenn ein Update es
verlangt (User, 16. Oktober 2026).

## Was man braucht

- Raspberry Pi 3 B+, Netzteil 5 V / 2,5 A, SD-Karte ab 8 GB (A1), Netzwerkkabel.
- Auf dem Mac das Binary: `pnpm --filter spiegel-bridge build` legt `apps/spiegel-bridge/dist/spiegel-bridge-linux-arm64`
  an (Version aus `git describe`).
- Ein Admin-Konto in Spiegel für den Kopplungscode. Der Code ist 15 Minuten gültig und einmal einlösbar.
- Den Zugang zur SSMDB2: der Standard-Zugang laut Meyton-Handbuch, Server `192.168.10.200`, Port 3306, Datenbank
  `SSMDB2`. Die Brücke erwartet ihn als eine Zeile `benutzer:passwort@tcp(192.168.10.200:3306)/SSMDB2`.

## 1. Karte vorbereiten (Raspberry Pi Imager)

- Gerät „Raspberry Pi 3“, Betriebssystem „Raspberry Pi OS Lite (64-bit)“ (unter „Raspberry Pi OS (other)“).
  **64-Bit ist Pflicht:** Gebaut wird nur `linux/arm64`. Auf dem 32-Bit-Image startet das Binary nicht.
- Anpassen: Hostname `spiegel-bridge`, eigener Benutzer mit Passwort, Hauptstadt Berlin (Zeitzone Europe/Berlin,
  Tastatur de), kein WLAN (der Pi hängt am Kabel), SSH an und nur mit öffentlichem Schlüssel (`~/.ssh/id_ed25519.pub`
  vom Mac einfügen), Raspberry Pi Connect aus.
- Der Login-Benutzer sollte nicht `spiegel-bridge` heißen: Gibt es den Namen schon, legt `install.sh` keinen eigenen
  Dienstbenutzer an, und der Dienst läuft als Login-Benutzer. Am Vereins-Pi ist es so eingerichtet und bleibt so (User,
  16. Oktober 2026): sudo verlangt dort ein Passwort, und die Unit setzt `NoNewPrivileges`, `ProtectHome` und
  `ProtectSystem=strict`, aus dem Dienst heraus gibt es also kein sudo und kein Home. Für einen neuen Pi einen anderen
  Namen wählen.

## 2. Erster Start zu Hause

1. Kabel ins Heimnetz, Strom an, ein bis zwei Minuten warten. Dann `ssh <benutzer>@spiegel-bridge.local`.
2. `uname -m` zeigt `aarch64`. Steht dort `armv7l`, ist das 32-Bit-Image drauf: Karte neu schreiben.
3. `sudo apt update && sudo apt full-upgrade -y && sudo reboot`. Das gehört nach Hause: Im Schützenhaus geht auch mal
   hart der Strom weg, ein abgebrochenes Upgrade dort kostet einen Abend.
4. `timedatectl` zeigt „System clock synchronized: yes“.
5. **Zeit vor dem Start erzwingen:** `sudo systemctl enable systemd-time-wait-sync.service`.

   Warum: Der Pi hat keine Echtzeituhr. Nach dem Einschalten steht seine Uhr auf dem zuletzt gespeicherten Stand, also
   auf dem letzten Abend, bis NTP antwortet. Die Unit der Brücke wartet zwar auf `time-sync.target`, das ist ohne diesen
   Dienst aber sofort erreicht. Die Brücke merkt eine alte Uhr selbst ([[spiegel-bridge]], „Uhrzeit“, SF-79): Sie
   misst ihre Uhr bei jedem Heartbeat an Spiegel, schickt nichts, solange sie mehr als 30 s daneben liegt, und meldet
   „Uhr am Gerät geht falsch“; Spiegel lehnt Beobachtungen, die mehr als 15 min zurückliegen, ohnehin ab. Mit dem
   Dienst startet die Brücke erst nach der Synchronisierung und muss gar nicht erst zurückhalten. Bekommt der Pi nie
   eine Zeit (NTP gesperrt), startet sie mit dem Dienst nie (in Spiegel „noch kein Kontakt“ oder „aus“), ohne ihn hält
   sie dauerhaft zurück (in Spiegel „Uhr am Gerät geht falsch“). Beides ist gewollt: lieber keine Daten als falsche
   Zeiten.
6. Optional, wenn der Pi nur am Kabel hängt: WLAN und Bluetooth ausschalten. In `/boot/firmware/config.txt` die Zeilen
   `dtoverlay=disable-wifi` und `dtoverlay=disable-bt` ergänzen und neu starten.

## 3. Brücke installieren

Auf dem Mac, im Repo:

```bash
scp apps/spiegel-bridge/dist/spiegel-bridge-linux-arm64 apps/spiegel-bridge/deploy/install.sh apps/spiegel-bridge/deploy/spiegel-bridge.service <benutzer>@spiegel-bridge.local:
```

Auf dem Pi:

```bash
sudo sh install.sh ./spiegel-bridge-linux-arm64
```

`install.sh` legt das Binary nach `/usr/local/bin`, den Benutzer `spiegel-bridge`, das Verzeichnis `/etc/spiegel-bridge`
(0700) und den Dienst an und meldet „installiert: <Version>“. Geprüft am 15. Oktober 2026 in `debian:trixie` (arm64):
Benutzer, Rechte, `systemd-analyze verify`, Exit 2 ohne Konfiguration.

## 4. Verbinden und starten (geht schon zu Hause)

1. In Spiegel unter Admin → Anlage und Brücke im Kasten „Brücke verbinden“ dem Gerät einen Namen geben und
   „Code erzeugen“ wählen. Spiegel zeigt den Code.
2. Auf dem Pi:

   ```bash
   sudo -u spiegel-bridge /usr/local/bin/spiegel-bridge pair --url https://spiegel.example.com --code ABCDE-FGHJK
   ```

   Statt `spiegel.example.com` die eigene Adresse von Spiegel. Die Brücke fragt den Zugang zur SSMDB2 als eine Zeile ab. Die Eingabe ist beim Tippen sichtbar, landet aber nicht im
   Verlauf der Shell und nicht in `ps`. Sie steht danach mit dem Geräte-Token in `/etc/spiegel-bridge/config.json`
   (0600, nur für den Dienst lesbar).
3. `sudo systemctl enable --now spiegel-bridge`. Hängt der Befehl, wartet der Dienst auf die Zeit (Schritt 2.5):
   `timedatectl` prüfen.
4. Zu Hause erreicht die Brücke die Anlage nicht. Sie meldet sich trotzdem jede Minute bei Spiegel. Unter Admin →
   Anlage und Brücke steht dann „erreicht die Meyton-Anlage nicht“, im Log `round-failed code=connection` oder
   `code=timeout`. Damit sind Verbindung, Internet und Zeit geprüft.

## 5. Im Schützenhaus

1. Pi ins Gerätenetz stecken (dort, wo der Meyton-Server hängt), Strom an. Die Adresse kommt per DHCP.
2. Ohne SSH prüfen: In Spiegel unter Admin → Anlage und Brücke steht bei der Brücke „läuft“ statt „erreicht die
   Meyton-Anlage nicht“.
3. Mit SSH (der Laptop muss im Gerätenetz sein, aus dem Gäste-LAN geht es nicht): `journalctl -u spiegel-bridge -f`.
4. Probe ohne Hochladen, wenn etwas unklar ist: `read -rs SPIEGEL_BRIDGE_DSN && export SPIEGEL_BRIDGE_DSN`, Zugang
   eintippen (unsichtbar), dann `/usr/local/bin/spiegel-bridge watch --once`. Je Scheibe eine Zeile ohne Namen. Danach
   `unset SPIEGEL_BRIDGE_DSN`.
5. Abnahme: ein Schuss auf einem Stand mit einem Konto, dessen Zustimmung bestätigt ist. Die Scheibe erscheint in
   Spiegel.

## Log lesen

`journalctl -u spiegel-bridge` zeigt nur Codes und Zahlen, nie Namen oder Nummern (SF-59).

| Zeile | Bedeutung |
|---|---|
| `start version=… bridge=…` | Dienst gestartet |
| `round-failed code=connection rounds=…` / `code=timeout` | Anlage aus oder nicht erreichbar; die Brücke wiederholt alle 10 s. Im Log steht der Fehler beim ersten Mal, bei einem neuen Code und danach alle 10 min, `rounds` zählt die gescheiterten Runden |
| `round-ok after=…` | die Anlage antwortet wieder, nach so vielen gescheiterten Runden |
| `round-failed code=mysql-1045` | Zugang zur SSMDB2 falsch: neu verbinden mit dem richtigen Zugang |
| `round-failed code=mysql-1049` | Datenbank `SSMDB2` gibt es unter dem Namen nicht |
| `batch …` | ein Stapel an Spiegel, mit den Ergebnissen als Zahlen |
| `state-failed`, `heartbeat-failed`, `upload-failed` | Spiegel nicht erreichbar (Internet, DNS, Zeit) |
| `throttled` | Spiegel bremst, die Brücke wartet `Retry-After` |
| `future` | die Uhr der Brücke geht vor; sie wartet eine Minute |
| `clock-wrong seconds=…` | die Uhr am Gerät liegt mehr als 30 s neben Spiegel (negativ: nach); die Brücke schickt nichts, bis sie stimmt. `timedatectl` prüfen |
| `clock-ok` | die Uhr stimmt wieder; was wartet, geht in der nächsten Runde hinaus |
| `clock-unmeasured ms=…` | Spiegel hat zu langsam geantwortet, um die Uhr zu beurteilen; die nächste Messung kommt mit dem nächsten Heartbeat |
| `past` | Spiegel fand eine Beobachtung zu alt; die Brücke misst ihre Uhr neu und schickt danach noch einmal |
| `code=tls-time` (bei `state-failed`, `heartbeat-failed`, `upload-failed`) | die Uhr am Gerät liegt vor dem Beginn des Zertifikats von Spiegel (etwa 1970): `timedatectl` prüfen |
| `code=tls-expired` | das Zertifikat von Spiegel ist abgelaufen (oder die Uhr am Gerät geht weit vor) |
| `possible-reset` | viele Scheiben fehlen auf einmal (Ablage geleert?); nur gemeldet |
| `card-reassigned scheibe=… lifesign=same` / `lifesign=moved` | die SportpassID einer Scheibe hat sich geändert (in Meyton umgebucht oder die Nummer in der Schützenliste korrigiert, SF-80); `same`: das Lebenszeichen blieb stehen, `moved`: es lief mit. Die Brücke liest die Scheibe neu |
| `unauthorized hint=neu-koppeln` | Brücke in Spiegel getrennt (Exit 3, kein Neustart): neu verbinden |
| `config-missing` | noch nicht verbunden (Exit 2, kein Neustart) |
| `notify-failed code=socket` | systemd nimmt die Meldungen der Brücke nicht an; der Dienst gilt dann nicht als gestartet. Unit und Version prüfen (Abschnitt „Updates“) |
| `Watchdog timeout`, `SIGABRT: abort`, Goroutinen, `status=6/ABRT` | Zeilen von systemd und Go: Die Brücke hing 10 min, systemd hat sie beendet und startet sie nach 10 s neu. Die Goroutinen zeigen, wo sie hing (nur Funktionen und Zahlen) |

**Umbuchen prüfen** (SF-80, einmal nach dem Update, das `card-reassigned` mitbringt): Was Meyton beim Umbuchen in die
SSMDB2 schreibt, ist nicht belegt.

1. Eine kurze Scheibe unter einem Namen ohne Zustimmung schießen (etwa einem Gastnamen) und 25 Minuten ruhen lassen.
2. In Meyton die Scheibe einem Schützen zuweisen, dessen Sportpassnummer in Spiegel bestätigt ist.
3. `journalctl -u spiegel-bridge --since "-10 min" | grep card-reassigned` zeigt die ScheibenID mit `lifesign=same`
   oder `moved`, und die Scheibe steht in Spiegel unter „Scheiben“ dieses Schützen.
4. Fehlt die Zeile, ändert Meyton beim Umbuchen die SportpassID in der SSMDB2 nicht. Das in [[meyton-ssmdb2]]
   eintragen, die Scheibe dann über „Scheibe per ID holen“ holen.
5. Den Befund zu `lifesign` als Antwort auf Schritt 12 des Schießprotokolls in [[meyton-ssmdb2]] eintragen.

## Dauerbetrieb

Der Pi darf dauerhaft laufen, die Meyton-Anlage wird weiter nach dem Training ausgeschaltet, im Sommer auch mal für
Wochen (User, 16. Oktober 2026).

- **Kein geplanter Neustart der Brücke.** Sie hat keinen Zustand, ihr Speicher ist begrenzt (eine Scheibe, die einen Tag
  nicht mehr in der Ablage stand, vergisst sie; `MemoryMax=128M`), die Verbindung zur SSMDB2 erneuert sie alle 10 min,
  und jede Anfrage hat eine Zeitgrenze. Ein Neustart würde nichts reparieren, aber zwei Lesungen und das Nachholen neu
  beginnen.
- **Absturz und Hänger:** Die Brücke meldet systemd nach jeder Runde und beim Warten jede Minute, dass sie lebt
  (`Type=notify`, `WatchdogSec=10min`). Bleibt das aus, beendet systemd sie und startet sie nach 10 s neu, ebenso nach
  einem Absturz. Dafür steht `GOTRACEBACK=crash` in der Unit: Go beendet einen Absturz sonst mit Exit 2, und der heißt
  „Konfiguration fehlt“, nach dem systemd bewusst nicht neu startet. Ein Core-Abbild entsteht nicht (`LimitCORE=0`), es
  enthielte Snapshots mit Namen. `WatchdogSec` nie unter fünf Minuten setzen: Ein Schritt darf mit allen Zeitgrenzen so lange dauern. Geprüft am 16. Oktober 2026 mit systemd in
  `debian:trixie` (arm64): Hänger → `Watchdog timeout`, `status=6/ABRT`, Neustart; 4 min Warten auf `Retry-After` ohne
  Neustart; Exit 2 ohne Neustart.
- **Wochen ohne Anlage:** Die Brücke versucht es alle 10 s und meldet sich jede Minute bei Spiegel. Dort steht dann
  „erreicht die Meyton-Anlage nicht“, das ist in dieser Zeit normal. Was am letzten Abend nicht hinauskam (etwa weil das
  Internet weg war), behält sie im Speicher und schickt es, sobald die Anlage wieder an ist. Startet der Pi in der Pause
  neu, liest sie es über das Startfenster und den Wasserstand in Spiegel nach, wie nach dem Einschalten. Aufträge zum
  Nachladen aus der Pause (QR von zu Hause, neue Zustimmungen) laufen bei durchlaufender Brücke zu Beginn des nächsten
  Abends, bevor geschossen wird. Nach einem Neustart in der Pause gelten die Scheiben im Startfenster zuerst als bewegt,
  dann laufen die Aufträge in kleinen Portionen hinter den laufenden Scheiben (SF-52). Spiegel schaltet die Scheiben
  eines Abends 12 h später endgültig, nach einem Neustart der Brücke sofort. Startet die Brücke mitten am Abend neu
  (Absturz, Watchdog), werden offene Scheiben so kurz endgültig; der nächste Schuss oder das nächste Lebenszeichen
  öffnet sie wieder. Belegt mit `TestWaitingCardSurvivesWeeksWithoutSource`. Fällt auch das Internet im Schützenhaus
  wochenlang aus, schreibt die Brücke `state-failed` und `heartbeat-failed` jede Minute, das ist dann normal.

## Den Pi im Netz finden (DHCP)

Das Gerätenetz vergibt die Adressen per DHCP (Stand 15. Oktober 2026). Die Brücke braucht keine feste Adresse, sie
verbindet sich nur nach außen. Für SSH muss man den Pi trotzdem finden:

- **`spiegel-bridge.local`** über mDNS (avahi, auf Raspberry Pi OS dabei). Das klappt aus demselben Netz. Gäste-LAN und
  Gerätenetz sind getrennt, also den Laptop ins Gerätenetz stecken.
- **Im Router:** DHCP meldet den Hostnamen, der Pi steht dort als `spiegel-bridge`. Eine FRITZ!Box löst zusätzlich
  `spiegel-bridge.fritz.box` auf.
- **Am besten eine DHCP-Reservierung** im Router (feste Adresse für die MAC aus `ip link show eth0`). Dann bleibt die
  Adresse gleich, ohne dass auf dem Pi etwas fest eingetragen ist.

[[adr-027]] sieht eine feste IP aus dem Workstation-Bereich des Meyton-IP-Plans vor (.201 bis .239). Mit DHCP weicht der
Aufbau davon ab. Für die Brücke ist das egal. Mit dem Betreuer der Anlage zu klären: Der DHCP-Bereich überschneidet sich
nicht mit den festen Meyton-Adressen, und der MySQL-Zugang ist nicht auf bestimmte Adressen beschränkt.

## Updates

### Brücke: von Hand vor Ort

Laptop im Gerätenetz, neues Binary auf dem Mac gebaut:

```bash
scp apps/spiegel-bridge/dist/spiegel-bridge-linux-arm64 apps/spiegel-bridge/deploy/install.sh apps/spiegel-bridge/deploy/spiegel-bridge.service <benutzer>@spiegel-bridge.local:
```

Auf dem Pi zuerst Binary und Unit als Rückfall sichern, dann installieren und **neu starten**. `install.sh` ersetzt
Binary und Dienst, startet die Brücke aber nicht neu:

```bash
cp /usr/local/bin/spiegel-bridge ~/spiegel-bridge.vorher && cp /etc/systemd/system/spiegel-bridge.service ~/spiegel-bridge.service.vorher && sudo sh install.sh ./spiegel-bridge-linux-arm64 && sudo systemctl restart spiegel-bridge
```

Die Konfiguration bleibt, neu verbinden ist nicht nötig. Die Version steht in Spiegel (der Heartbeat meldet sie) und in
`spiegel-bridge version`. Ab der Version mit Watchdog zeigt `systemctl show -p Type,WatchdogUSec spiegel-bridge`
`notify` und `10min`.

Zurück geht es mit Binary **und** Unit von vorher. Eine ältere Brücke meldet sich nicht bei systemd; unter der neuen
Unit gälte sie nach 90 s als nicht gestartet und würde immer wieder neu gestartet:

```bash
sudo install -m 0755 ~/spiegel-bridge.vorher /usr/local/bin/spiegel-bridge && sudo cp ~/spiegel-bridge.service.vorher /etc/systemd/system/spiegel-bridge.service && sudo systemctl daemon-reload && sudo systemctl restart spiegel-bridge
```

### Fernzugang (nur nach Entscheidung)

Tailscale oder ein ähnlicher Client gäbe SSH von überall, ohne Adresse und ohne offenen Port. Er öffnet aber einen
dauernden Weg ins Gerätenetz, in dem der Meyton-Server mit dem Standard-Zugang aus dem Handbuch steht. [[adr-027]] hat
ein VPN ins Vereinsnetz verworfen. Dafür müsste die ADR geändert werden.

### Betriebssystem

Am Vereins-Pi eingerichtet (16. Oktober 2026): `unattended-upgrades` mit nächtlichem Neustart, wenn ein Update ihn
verlangt. Eine eigene Datei, damit die von Debian unberührt bleibt (eine höhere Nummer wird später gelesen und gewinnt):

```bash
sudo tee /etc/apt/apt.conf.d/52unattended-upgrades-local >/dev/null <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
```

- Die Updates laufen über `apt-daily-upgrade.timer` gegen 06:00 (bis zu einer Stunde Zufall). Neu gestartet wird nur,
  wenn ein Paket `/var/run/reboot-required` anlegt, dann zur nächsten 04:00. Läuft der Pi nicht durch, holen die Timer
  verpasste Läufe nach dem Einschalten nach; geht der Strom mitten im Update weg, räumt der nächste Lauf auf
  (`dpkg --configure -a`).
- **Erlaubt sind nur die Quellen von Debian** (die Vorgabe). Kernel und Firmware kommen aus `archive.raspberrypi.com` und
  damit nicht automatisch. Das ist gewollt (User, 16. Oktober 2026): Ein schiefes Kernel-Update ließe den Pi stehen, und
  jemand müsste hinfahren. Sie kommen bei einem Besuch vor Ort mit `sudo apt full-upgrade && sudo reboot`. Auf diesem Pi
  braucht Debian selbst selten einen Neustart: Die Brücke ist ein statisches Binary, Dienste wie `sshd` starten ihre
  Pakete selbst neu.
- Nach dem Neustart wartet die Brücke auf die Zeit (`systemd-time-wait-sync`, Schritt 2.5) und läuft dann von selbst
  weiter.

Prüfen:

```bash
apt-config dump | grep -i 'Automatic-Reboot'
sudo unattended-upgrade --dry-run --debug 2>&1 | grep -i 'allowed origins'
apt-cache policy $(dpkg -l 'linux-image-*' | awk '/^ii/{print $2}' | head -1)
uname -r
ls /var/run/reboot-required && shutdown --show
```

Der laufende Kernel ist `…-rpi-v8` (Pi 3 B+); `…-rpi-2712` ist für den Pi 5 mitinstalliert und hier ohne Bedeutung.
