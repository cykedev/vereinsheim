---
id: spiegel-bridge-pi
type: operation
title: "Spiegel — Brücke auf dem Raspberry Pi einrichten und aktualisieren"
aliases: [brücke-einrichten, bridge-pi, pi-setup, brücke-aktualisieren]
keywords: [raspberry pi 3 b+, raspberry pi os lite, imager, 64-bit, arm64, aarch64, dhcp, mdns, avahi, .local, ssh, hostname, scp, install.sh, systemd, journalctl, timedatectl, ntp, fake-hwclock, systemd-time-wait-sync, zeitsynchronisierung, echtzeituhr, kopplung, pair, update, aktualisieren, rückfall, rollback, unattended-upgrades, tailscale, fernwartung, dhcp-reservierung]
operation_of: ["[[spiegel-bridge]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[spiegel-ingest-pipeline]]", "[[meyton-ssmdb2]]"]
---

**TL;DR** Die Brücke läuft auf einem Raspberry Pi 3 B+ mit Raspberry Pi OS Lite **64-Bit**. Die Karte entsteht im
Imager mit Hostname `spiegel-bridge` und SSH-Schlüssel. Zu Hause wird aktualisiert, die Zeitsynchronisierung erzwungen,
mit `install.sh` installiert und mit Spiegel verbunden. Danach kommt der Pi ins Gerätenetz. Er bekommt seine Adresse per DHCP und
ist dort unter `spiegel-bridge.local` erreichbar. Updates spielt man von Hand vor Ort ein, ein Selbst-Update ist
zurückgestellt (User, 15. Oktober 2026).

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

## 2. Erster Start zu Hause

1. Kabel ins Heimnetz, Strom an, ein bis zwei Minuten warten. Dann `ssh <benutzer>@spiegel-bridge.local`.
2. `uname -m` zeigt `aarch64`. Steht dort `armv7l`, ist das 32-Bit-Image drauf: Karte neu schreiben.
3. `sudo apt update && sudo apt full-upgrade -y && sudo reboot`. Das gehört nach Hause: Im Schützenhaus wird hart
   ausgeschaltet, ein abgebrochenes Upgrade dort kostet einen Abend.
4. `timedatectl` zeigt „System clock synchronized: yes“.
5. **Zeit vor dem Start erzwingen:** `sudo systemctl enable systemd-time-wait-sync.service`.

   Warum: Der Pi hat keine Echtzeituhr. Nach dem Einschalten steht seine Uhr auf dem zuletzt gespeicherten Stand, also
   auf dem letzten Abend, bis NTP antwortet. Die Unit der Brücke wartet zwar auf `time-sync.target`, das ist ohne diesen
   Dienst aber sofort erreicht. Eine Brücke mit alter Uhr schickt Stände mit Beobachtungszeiten vom letzten Abend.
   Spiegel lehnt nur eine vorgehende Uhr ab (`future`). Eine nachgehende nimmt es an und misst daraus eine falsche
   Uhrabweichung der Anlage. Mit dem Dienst startet die Brücke erst nach der Synchronisierung. Bekommt der Pi nie eine
   Zeit (NTP gesperrt), startet sie nie. Das ist gewollt: lieber keine Daten als falsche Zeiten.
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
| `round-failed code=connection` / `code=timeout` | Anlage aus oder nicht erreichbar; die Brücke wiederholt |
| `round-failed code=mysql-1045` | Zugang zur SSMDB2 falsch: neu verbinden mit dem richtigen Zugang |
| `round-failed code=mysql-1049` | Datenbank `SSMDB2` gibt es unter dem Namen nicht |
| `batch …` | ein Stapel an Spiegel, mit den Ergebnissen als Zahlen |
| `state-failed`, `heartbeat-failed`, `upload-failed` | Spiegel nicht erreichbar (Internet, DNS, Zeit) |
| `throttled` | Spiegel bremst, die Brücke wartet `Retry-After` |
| `future` | die Uhr der Brücke geht vor; sie wartet eine Minute |
| `possible-reset` | viele Scheiben fehlen auf einmal (Ablage geleert?); nur gemeldet |
| `unauthorized hint=neu-koppeln` | Brücke in Spiegel getrennt (Exit 3, kein Neustart): neu verbinden |
| `config-missing` | noch nicht verbunden (Exit 2, kein Neustart) |

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

Auf dem Pi zuerst das alte Binary als Rückfall sichern, dann installieren und **neu starten**. `install.sh` ersetzt Binary
und Dienst, startet die Brücke aber nicht neu:

```bash
cp /usr/local/bin/spiegel-bridge ~/spiegel-bridge.vorher && sudo sh install.sh ./spiegel-bridge-linux-arm64 && sudo systemctl restart spiegel-bridge
```

Die Konfiguration bleibt, neu verbinden ist nicht nötig. Die Version steht in Spiegel (der Heartbeat meldet sie) und in
`spiegel-bridge version`. Zurück geht es mit `sudo sh install.sh ~/spiegel-bridge.vorher` und einem Neustart.

### Fernzugang (nur nach Entscheidung)

Tailscale oder ein ähnlicher Client gäbe SSH von überall, ohne Adresse und ohne offenen Port. Er öffnet aber einen
dauernden Weg ins Gerätenetz, in dem der Meyton-Server mit dem Standard-Zugang aus dem Handbuch steht. [[adr-027]] hat
ein VPN ins Vereinsnetz verworfen. Dafür müsste die ADR geändert werden.

### Betriebssystem

Vorschlag: `sudo apt install unattended-upgrades`, nur Sicherheitsupdates von Debian (die Vorgabe). Die Timer holen
verpasste Läufe nach dem Einschalten nach, die Updates laufen also am Anfang eines Abends. Geht der Strom mitten im
Update weg, räumt der nächste Lauf auf (`dpkg --configure -a`). Wer das nicht will, aktualisiert vor Ort mit
`apt full-upgrade`, nie kurz vor dem Ausschalten.
