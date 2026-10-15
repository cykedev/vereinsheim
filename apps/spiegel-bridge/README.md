# Spiegel-Brücke

Die Brücke läuft im Schützenhaus neben der Meyton-Anlage. Sie liest die Meyton-Ablage (SSMDB2) nur lesend, erkennt
neue und geänderte Scheiben und lädt sie als Snapshot v1 zu [Spiegel](../spiegel) hoch. Ein statisches Go-Binary ohne
Laufzeit, auf der Platte liegt nur die Konfiguration. Hintergrund und Arbeitsweise:
[`vault/spiegel/spiegel-bridge.md`](../../vault/spiegel/spiegel-bridge.md),
Entscheidung: [ADR-027](../../vault/decisions/adr-027.md).

Die Brücke

- schreibt nie in die Meyton-Datenbank und öffnet keinen Port, sie verbindet sich nur ausgehend per HTTPS zu Spiegel,
- lädt nur Scheiben von Schützen hoch, die in Spiegel zugestimmt haben, und nie eine verdeckte Wertung,
- schreibt keine Namen oder Sportpassnummern in ihre Ausgabe,
- verträgt hartes Ausschalten: Beim nächsten Start holt sie nach, was noch nicht in Spiegel ist.

## Voraussetzungen

- Ein Gerät im Gerätenetz der Anlage, zum Beispiel ein Raspberry Pi (linux/arm64), ein Mini-PC (linux/amd64) oder der
  Meyton-Rechner. Als Dienst unterstützt ist Linux mit systemd. Unter Windows läuft das Binary, aber noch ohne Dienst,
  und `pair` ist dort gesperrt.
- Lesender Zugang zur SSMDB2 (Host, Benutzer, Passwort laut Meyton-Handbuch, abgestimmt mit dem Betreuer der Anlage).
- Ausgehend Internet: DNS, HTTPS zu Spiegel, NTP.
- Ein Admin-Konto in Spiegel.

## Bauen

Auf dem Entwicklungsrechner im Repo (Go ≥ 1.24):

```bash
pnpm --filter spiegel-bridge build
```

Das legt drei Binaries in `apps/spiegel-bridge/dist/` ab: `spiegel-bridge-linux-arm64`, `spiegel-bridge-linux-amd64`,
`spiegel-bridge-windows-amd64.exe`. Die Version kommt aus `git describe`.

## Installieren (Linux mit systemd)

Schritt für Schritt auf dem Raspberry Pi (Imager, Zeit, DHCP, Prüfen vor Ort):
[`vault/spiegel/spiegel-bridge-pi.md`](../../vault/spiegel/spiegel-bridge-pi.md). Ein Gerät ohne Echtzeituhr wie der Pi
braucht vorher `sudo systemctl enable systemd-time-wait-sync.service`, sonst startet die Brücke mit der Uhr vom letzten
Abend.

1. Das passende Binary und den Ordner `deploy/` (`install.sh` und `spiegel-bridge.service`) auf das Gerät kopieren.
   `install.sh` erwartet die Unit im selben Ordner.
2. Installieren:

   ```bash
   sudo sh deploy/install.sh ./spiegel-bridge-linux-arm64
   ```

   Das legt `/usr/local/bin/spiegel-bridge`, den Systembenutzer `spiegel-bridge`, `/etc/spiegel-bridge` (0700) und den
   Dienst an. Ein zweiter Lauf ersetzt nur Binary und Dienst, die Konfiguration bleibt.
3. In Spiegel unter **Admin → Anlage und Brücke** im Kasten „Brücke verbinden“ dem Gerät einen Namen geben und
   „Code erzeugen“ wählen. Der Code für die Brücke gilt 15 Minuten und nur einmal.
4. Koppeln. Der Zugang zur SSMDB2 wird abgefragt, damit das Passwort nicht in der Befehlszeile und in `ps` steht:

   ```bash
   sudo -u spiegel-bridge /usr/local/bin/spiegel-bridge pair --url https://spiegel.example.com --code ABCDE-FGHJK
   ```

5. Starten:

   ```bash
   sudo systemctl enable --now spiegel-bridge
   ```

Danach zeigt Spiegel unter „Anlage und Brücke“ den Zustand der Brücke und den letzten Kontakt.

## Betrieb

- Der Dienst läuft ohne Rechte, mit schreibgeschütztem System und höchstens 128 MB.
- Logs: `journalctl -u spiegel-bridge -f`. Die Zeilen enthalten nur Zahlen und Codes, keine Personendaten.
- Exit 3 heißt: Die Brücke wurde in Spiegel getrennt. Dann neu verbinden (Schritte 3 und 4). Bei Exit 2 und 3
  startet systemd den Dienst nicht immer wieder neu.
- Update: neues Binary bauen und `install.sh` erneut ausführen, dann `sudo systemctl restart spiegel-bridge`.
- Gerät oder Speicherkarte getauscht: neu installieren und verbinden. Die Brücke holt ab dem letzten Stand nach, den
  Spiegel kennt.

## Lokal ausprobieren

```bash
SPIEGEL_BRIDGE_DSN='user:passwort@tcp(host:3306)/SSMDB2' go run ./cmd/spiegel-bridge watch --once
```

`watch` liest nur und gibt je Snapshot eine Zeile ohne Personenfelder aus; `--json` gibt die vollen Snapshots aus und
ist für die Prüfung vor Ort gedacht. Den Zugang über `SPIEGEL_BRIDGE_DSN` geben, nicht über `--dsn`.

## Entwickeln

| Befehl                                | Zweck                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm --filter spiegel-bridge test`   | Go-Tests, auch gegen die Testvektoren aus `packages/ingest-contract`       |
| `pnpm --filter spiegel-bridge replay` | alle Fälle aus `packages/ssmdb2-cases` gegen MariaDB 10.6 in Docker         |
| `pnpm --filter spiegel bridge-e2e`    | Ende zu Ende gegen einen lokalen Build von Spiegel (vorher `pnpm --filter spiegel build`) |
| `pnpm check`                          | das ganze Gate vom Repo-Root, für die Brücke `go vet`, `gofmt`, `go test`, `go build` |

Hinweise für Änderungen am Code stehen in [`CLAUDE.md`](CLAUDE.md).
