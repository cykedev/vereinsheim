# Plan — vereinsheim

> Living document. **Was ist fertig, was kommt als nächstes.**
> Architektur und Entscheidungen siehe [`spec.md`](spec.md) und
> [`decisions.md`](decisions.md). Operations siehe [`operations.md`](operations.md).

## Status

| Phase | Was                                                  | Status      |
| ----- | ---------------------------------------------------- | ----------- |
| 1     | Repo-Bootstrap (Spec, Plan, README)                  | ✅ erledigt |
| 2     | Compose-Setup, Caddy, db-init, Operations-Skripte    | ✅ erledigt |
| 3     | `vereinsheim` CLI + `bootstrap-vps.sh` + Operations-Doc | ✅ erledigt |
| 3.5   | End-to-End-Test auf lokaler VM                       | ✅ validiert |
| 4     | App-Repo-Anpassungen (Ringwerk + Treffsicher)        | ✅ erledigt |
| 5     | VPS-Provisioning (Bestellung, Bootstrap, DNS, Setup) | ✅ erledigt |
| 6     | Cutover bestehender Daten + Backup-Cron              | ✅ erledigt |

**Go-Live: Ende Mai 2026.** Beide Apps laufen seitdem produktiv auf dem
VPS (IONOS, Debian 13), inklusive täglichem Backup-Cron um 03:00. Die
Roadmap ist damit abgeschlossen; die Phasen-Abschnitte unten bleiben als
Referenz für Re-Provisioning bzw. künftige Migrationen stehen. Für den
laufenden Betrieb siehe [`operations.md`](operations.md).

---

## Phase 4 — App-Repo-Anpassungen

**Erledigt am 2026-05-11** in beiden App-Repos
(`a8c03df` in Ringwerk, `3962ddd` in Treffsicher): `.env.example`-
Eintrag `AUTH_TRUST_PROXY_HEADERS=false` (Default) mit Kommentar zur
Aktivierung bei Reverse-Proxy-Deployment via vereinsheim. Code-Änderungen
waren keine nötig — beide Apps lesen den Schalter bereits aus env vars.
`compose.yml` setzt ihn für beide App-Services auf `"true"`
([compose.yml:82](../compose.yml), [compose.yml:104](../compose.yml)).

---

## Phase 5 — VPS-Provisioning

**Erledigt Ende Mai 2026.** VPS bei IONOS provisioniert (Debian 13 statt
des ursprünglich geplanten Debian 12), Bootstrap, DNS und Setup wie unten
beschrieben durchgeführt. Die Schritte bleiben als Referenz für ein
etwaiges Re-Provisioning stehen.

### 5.1 — VPS bestellen

- Anbieter: IONOS
- Tarif: VPS S+/M (2 vCPU, 4 GB RAM, 80 GB SSD) — siehe Sizing in
  [`spec.md`](spec.md#vps-sizing)
- OS: Debian 13

### 5.2 — Initial-Bootstrap (als root, 1× pro VPS)

```bash
ssh root@<vps>
bash bootstrap-vps.sh \
  "ssh-ed25519 AAAA... du@workstation" \
  "https://github.com/<user>/vereinsheim.git"
```

Das Skript installiert Docker, legt `deploy`-User mit
SSH-Key an, klont das Repo nach `~deploy/vereinsheim`,
provisioniert `/var/backups/vereinsheim` mit Owner `deploy`. Es lässt
`sshd_config` bewusst unangetastet — du sperrst dich nicht selbst aus.
Befehl zum nachträglichen root-SSH-Lockdown gibt das Skript am Ende aus.
Firewall wird **nicht** im OS konfiguriert — das übernimmt die externe
IONOS-Firewall (nur 22/80/443 freigeben), siehe ADR-014.

### 5.3 — Konfiguration (als deploy-User)

```bash
ssh deploy@<vps>
cd ~/vereinsheim
./scripts/vereinsheim setup     # interaktiver .env-Wizard
./scripts/vereinsheim cron      # Backup-Cron (idempotent)
```

### 5.4 — DNS-Records

A-Records für `RINGWERK_HOST` und `TREFFSICHER_HOST` (aus `.env`) auf die
VPS-IP. TTL kurz halten (60 s) während des Cutover-Fensters.

### 5.5 — Lokal-Setup (1× pro lokalem Klon)

```bash
cd ~/repos/vereinsheim
./scripts/vereinsheim local-setup    # VPS_HOST, VPS_REPO_PATH, DOCKER_USER
docker login docker.io               # Docker-Hub-Auth (1× pro Maschine)
```

### 5.6 — Erster Deploy

Lokal, ein Befehl:

```bash
./scripts/vereinsheim release
```

Bei Caddy-LE-Erstaufbau empfehlenswert: zuerst Staging-ACME nutzen
(siehe Kommentar im [`Caddyfile`](../Caddyfile)), um Rate-Limits zu
vermeiden. Nach erfolgreichem Staging-Cert auf Produktiv-ACME umstellen,
`docker compose down caddy && docker volume rm vereinsheim_caddy_data &&
./scripts/vereinsheim up`.

---

## Phase 6 — Cutover bestehender Daten

**Erledigt Ende Mai 2026.** Beide Apps mit Bestandsdaten migriert, DNS
umgestellt, Backup-Cron aktiv. Die Schritte bleiben als Referenz für
künftige Migrationen stehen.

Pro App nacheinander, mit Maintenance-Fenster (~30 Min je App).

1. **Quellseite** (alte Umgebung):
   ```bash
   docker exec <old-db> pg_dump -U <user> -Fc <db> > ringwerk-$(date +%F).dump
   tar czf uploads-ringwerk-$(date +%F).tar.gz -C <uploads-mount> .
   ```
2. **Transfer**: `scp` zum VPS in `~/migration/`.
3. **Zielseite** (App noch nicht hochgefahren — nur `db`):
   ```bash
   ./scripts/vereinsheim down  # falls schon Apps liefen
   docker compose up -d db     # nur db
   ./scripts/vereinsheim restore   # interaktiv: App + Dump-Datei wählen
   ```
4. **App starten**:
   ```bash
   docker compose up -d migrate-ringwerk app-ringwerk
   ```
   Migrate fährt etwaige neuere Migrations nach (= no-op, falls Quelle und
   Ziel bereits gleichen Migrations-Stand haben).
5. **Smoke-Test** (siehe [`operations.md`](operations.md#verifikation)).
6. **DNS umstellen** (A-Record auf VPS-IP).
7. **Treffsicher analog.**
8. Alte Instanz **nicht sofort abreißen** — 1 Woche Puffer für Rollback.

Detaillierte Restore-Mechanik: [`operations.md`](operations.md#restore).

---

## Verifikation (End-to-End nach Phase 6)

1. `docker compose config` ohne Fehler.
2. `caddy validate` (im Caddy-Container) ohne Fehler.
3. `dig +short $RINGWERK_HOST $TREFFSICHER_HOST` → VPS-IP.
4. `curl -vI https://$RINGWERK_HOST/` → 200, gültiges Let's-Encrypt-Cert.
5. Login mit `RINGWERK_SEED_ADMIN_EMAIL` → Dashboard.
6. PDF-Upload (Treffsicher) landet im `uploads_treffsicher`-Volume.
7. **DB-Isolation**: `docker compose exec db psql -U treffsicher -d ringwerk
   -c '\dt'` muss **fehlschlagen** (permission denied).
8. **Proxy-Headers**: failed login → `LoginRateLimitBucket` zeigt echte
   Client-IP, nicht Caddy-Container-IP.
9. `./scripts/vereinsheim status` zeigt alle Services running, alle
   Volumes mit Größe, mindestens ein Backup.
10. Backup-Cron läuft (siehe `grep CRON /var/log/syslog` nach 03:00).

Komplette Liste mit Befehlen: [`operations.md`](operations.md#verifikation).

---

## Aufwand

| Phase | Aufwand |
| ----- | ------: |
| 4 App-Repo-Anpassungen | 30 min |
| 5 VPS-Provisioning | 1.5 h (inkl. DNS-Propagation) |
| 6 Cutover (beide Apps) | 2 h (mit Maintenance-Fenster) |
| **Total für Go-Live** | **~4 h** |

---

## Verweise

- [`spec.md`](spec.md) — Anforderungen, Sizing, Architektur
- [`decisions.md`](decisions.md) — ADRs, Begründungen, verworfene Alternativen
- [`operations.md`](operations.md) — Daily Ops, Backup, Restore, Migration-Recovery
- App-Repos: `../ringwerk`, `../treffsicher`
