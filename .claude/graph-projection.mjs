// Manifest: project/app/feature/subsystem/domain-rule/operation/ops-constraint — Quelle für den Doku-Index-Builder (ADR-022).
// Von Hand bzw. via /sync-graph gepflegt; der Builder (.claude/build-graph.mjs)
// mergt sie mit den aus decisions.md geparsten ADRs zu knowledge-graph.json.
// Dieses Artefakt NICHT von Hand editieren.

export default {
  "entities": [
    {
      "name": "vereinsheim",
      "entityType": "project",
      "observations": [
        "Code- + Deployment-Monorepo (pnpm + Turborepo) für zwei Next.js-Apps auf einem VPS.",
        "Build: turbo prune + Root-Dockerfile → Docker Hub; VPS pullt. Deploy-Vertrag (compose.yml/Caddy/db-init) unverändert.",
        "Migration: Phasen 1+2+3+4 erledigt (Stand Juni 2026). Phase 1 Struktur (apps/* via git filter-repo, pnpm+Turborepo+Catalog), Phase 2 Harness/Knowledge (ADR-016–019) + packages/config, Phase 3 Build aus Monorepo (turbo prune, auf VPS deployed), Phase 4 packages/lib (Zyklus 1) + packages/ui (Zyklus 2) echt geteilt. Offen nur Phase 5 (CI + Turbo-Remote-Cache, optional, supersedet ADR-006).",
        "Geteilte Pakete live: @vereinsheim/config (tsconfig/eslint/prettier/postcss/next), @vereinsheim/lib (cn, forms/fieldErrors, useUnsavedChangesGuard, useNavigationConfirm, dateTime server-only), @vereinsheim/ui (17 ui-Primitives + 4 shell/ + theme.css). Drift ist dort strukturell unmöglich; consistency-check.sh deckt nur noch 5 triviale Next/shadcn-Reste (components.json + globals.css-Stub + Error-Boundaries) ab.",
        "Doc-Drift (Stand 2026-06-23): CLAUDE.md-Text ('Nächster Schritt: Phase 4') und monorepo-plan.md-Header ('Phase 4 offen') sind veraltet; architecture.md, shared-conventions.md und monorepo-plan §8-Tabelle (Phase 4 Zyklus 1+2 ✅) + Ground Truth (packages/ui|lib existieren) sind die korrekte Quelle."
      ]
    },
    {
      "name": "ringwerk",
      "entityType": "app",
      "observations": [
        "Liga- & Wettkampf-Verwaltung. apps/ringwerk, Dev-Port 3000."
      ]
    },
    {
      "name": "treffsicher",
      "entityType": "app",
      "observations": [
        "Trainings-App (Tagebuch, Ergebnisse, Statistik, Mentaltraining). apps/treffsicher, Dev-Port 3001, Dark-Mode-only."
      ]
    },
    {
      "name": "competition-types",
      "entityType": "feature",
      "observations": [
        "Drei Wettbewerbstypen LEAGUE / EVENT / SEASON, teilen die gemeinsame Scoring-Engine; typ-spezifische Flows + Felder.",
        "→ apps/ringwerk/docs/features.md",
        "→ apps/ringwerk/docs/data-model.md"
      ]
    },
    {
      "name": "scoring-engine",
      "entityType": "subsystem",
      "observations": [
        "7 Wertungsmodi (RINGTEILER/RINGS/RINGS_DECIMAL/TEILER/DECIMAL_REST/TARGET_*) in calculateScore.ts; reine Funktionen, parametrisierte Tests.",
        "→ apps/ringwerk/docs/features.md",
        "→ apps/ringwerk/docs/technical.md"
      ]
    },
    {
      "name": "factor-correction",
      "entityType": "domain-rule",
      "observations": [
        "Teiler × Disziplin.teilerFaktor — greift NUR bei gemischten Wettbewerben (Competition.disciplineId === null), sonst Faktor 1.0; zentralisiert via effectiveTeilerFaktor(), nicht rückwirkend.",
        "→ apps/ringwerk/docs/features.md",
        "→ apps/ringwerk/docs/data-model.md"
      ]
    },
    {
      "name": "league-mode",
      "entityType": "feature",
      "observations": [
        "Formate DOUBLE_ROUND_ROBIN oder BEST_OF_SINGLE; Circle-Method-Spielplan (Freilos=2 Pkt), optionale Playoffs.",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "best-of-single",
      "entityType": "feature",
      "observations": [
        "Liga-Gruppenphase mit N Duellen je Begegnung (groupBestOf, default 3); Stechschuss bei Gleichstand (siehe Incident stechschuss-modell-flip).",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "event-mode",
      "entityType": "feature",
      "observations": [
        "Einmaliges Event; eine Serie je TN; Gastschützen + TARGET-Modi + Team-Events (SUM/BEST) möglich.",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "season-mode",
      "entityType": "feature",
      "observations": [
        "Langzeit; beste Serien zählen, Mehrfach-Ranking (Ringe/Teiler/Ringteiler), Mindestserien-Gate (minSeries default 20).",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "disciplines-and-factors",
      "entityType": "feature",
      "observations": [
        "System-Disziplinen LP/LG/LPA/LGA mit teilerFaktor; WHOLE vs. DECIMAL; Archivierung statt Löschen bei vorhandenen Ergebnissen.",
        "→ apps/ringwerk/docs/data-model.md",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "participants-and-enrollment",
      "entityType": "feature",
      "observations": [
        "Teilnehmerpool + Einschreibung pro Wettbewerb (CompetitionParticipant, Status ACTIVE/WITHDRAWN); Gäste nur bei Events.",
        "→ apps/ringwerk/docs/features.md",
        "→ apps/ringwerk/docs/data-model.md"
      ]
    },
    {
      "name": "series-unified-model",
      "entityType": "subsystem",
      "observations": [
        "Universelle Ergebniseinheit (ersetzte MatchResult): rings/teiler/disciplineId/duelNumber/isTiebreak/isGuest, verknüpft via competitionParticipantId + optional matchupId.",
        "→ apps/ringwerk/docs/data-model.md"
      ]
    },
    {
      "name": "playoffs-knockout-system",
      "entityType": "feature",
      "observations": [
        "Liga-K.o. nach Gruppenphase, Best-of-N (playoffBestOf), eigenes Finale-Format; playoffMatch.count>0 sperrt Edits (siehe ruleset-lock-granularity).",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "meyton-import",
      "entityType": "feature",
      "observations": [
        "Ergebnisübernahme aus Meyton via URL/PDF, nur Liga; textbasiert (kein OCR), DoS-Grenzen (2MB/Stream, 8MB, 10MB/15s URL).",
        "→ apps/ringwerk/docs/features.md",
        "→ apps/ringwerk/docs/technical.md"
      ]
    },
    {
      "name": "pdf-public-urls",
      "entityType": "feature",
      "observations": [
        "isPublic→publicSlug für /api/public/c/<slug>/pdf (unauth); partieller Unique-Index, optional bcrypt-PW, 24h-Cache (tagged by slug).",
        "→ apps/ringwerk/docs/features.md",
        "→ apps/ringwerk/docs/architecture.md"
      ]
    },
    {
      "name": "role-based-access",
      "entityType": "subsystem",
      "observations": [
        "Rollen ADMIN/MANAGER/USER, vereinsweite Sichtbarkeit (KEIN userId-Filter) — Kontrast zu treffsicher (per-User). Auth via proxy.ts + Layout-Guards.",
        "→ apps/ringwerk/docs/architecture.md",
        "→ apps/ringwerk/docs/code-conventions.md"
      ]
    },
    {
      "name": "audit-logging",
      "entityType": "subsystem",
      "observations": [
        "Protokolliert Verwaltungsaktionen (USER_/PARTICIPANT_/…/DESTRUCTIVE), competitionId-FK, Details-JSON-Snapshot; macht FORCE_DELETE nachvollziehbar.",
        "→ apps/ringwerk/docs/data-model.md",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "action-result-convention",
      "entityType": "subsystem",
      "observations": [
        "Ringwerk-Kanon (Zielform für treffsicher): { success:true; data?:T } | { error: string|Record<string,string[]> }; Zod + useActionState. Siehe treffsicher-actionresult-migration.",
        "→ docs/shared-conventions.md",
        "→ apps/ringwerk/docs/code-conventions.md"
      ]
    },
    {
      "name": "phase-locking-and-editability",
      "entityType": "domain-rule",
      "observations": [
        "Liga-Edits gesperrt ab Spielplan (matchupCount>0); Playoff-Settings bis Playoff-Start (playoffMatch.count>0) — Granularität an Wirk-Zeitpunkt (ruleset-lock-granularity).",
        "→ apps/ringwerk/docs/features.md"
      ]
    },
    {
      "name": "ringwerk-auth-security",
      "entityType": "subsystem",
      "observations": [
        "NextAuth v4 + bcrypt; Login-Rate-Limit 5/E-Mail, 30/IP, 15min; Seed-Admin via SEED_ADMIN_* (treffsicher: ADMIN_*, Angleichung offen).",
        "→ apps/ringwerk/docs/architecture.md",
        "→ apps/ringwerk/docs/technical.md"
      ]
    },
    {
      "name": "training-sessions",
      "entityType": "feature",
      "observations": [
        "Session-zentrisch, 4 Typen TRAINING/WETTKAMPF/TROCKENTRAINING/MENTAL; nur TRAINING/WETTKAMPF mit Serien/Anhängen/Mental-Modulen.",
        "→ apps/treffsicher/docs/requirements.md",
        "→ apps/treffsicher/docs/data-model.md"
      ]
    },
    {
      "name": "result-recording-validation",
      "entityType": "domain-rule",
      "observations": [
        "Ganzringe 0–10, Zehntelringe 0.0 oder 1.0–10.9 (0.1–0.9 ungültig); Probe zählt nicht; Ausführungsqualität 1–5 je Serie.",
        "→ apps/treffsicher/docs/requirements.md"
      ]
    },
    {
      "name": "treffsicher-meyton-import",
      "entityType": "subsystem",
      "observations": [
        "Meyton-Import im Einheit-Formular (URL/Datei), textbasiert, ersetzt Formular-Serien; DoS-Härtung (10MB/15s, 2MB/Stream, 8MB, 25k Tokens).",
        "→ apps/treffsicher/docs/requirements.md",
        "→ apps/treffsicher/docs/technical-constraints.md"
      ]
    },
    {
      "name": "wellbeing-tracking",
      "entityType": "feature",
      "observations": [
        "Befinden vor der Einheit (Schlaf/Energie/Stress/Motivation 0–100), optional; fließt in Statistik-Korrelation.",
        "→ apps/treffsicher/docs/requirements.md"
      ]
    },
    {
      "name": "mental-modules",
      "entityType": "feature",
      "observations": [
        "Reflexion/Prognose/Feedback je Einheit; 7 Dimensionen (Kondition…Material 0–100); nur TRAINING/WETTKAMPF.",
        "→ apps/treffsicher/docs/requirements.md"
      ]
    },
    {
      "name": "shot-routines",
      "entityType": "subsystem",
      "observations": [
        "Eigenständiges Routine-Dokument (geordnete Schritte, pro Nutzer, optional Disziplin); Einheiten verknüpfen + Abweichungen notieren.",
        "→ apps/treffsicher/docs/requirements.md",
        "→ apps/treffsicher/docs/data-model.md"
      ]
    },
    {
      "name": "seasonal-goals",
      "entityType": "feature",
      "observations": [
        "Zeitraum-Ziele (RESULT/PROCESS), frei wählbarer Zeitraum, M:N zu Sessions.",
        "→ apps/treffsicher/docs/requirements.md",
        "→ apps/treffsicher/docs/data-model.md"
      ]
    },
    {
      "name": "statistics-visualization",
      "entityType": "subsystem",
      "observations": [
        "Konfigurierbare Zeiträume + Filter (nie gemischte Disziplinen); 7 Ansichten inkl. 7D-Radar; Meyton-Farbschema.",
        "→ apps/treffsicher/docs/requirements.md"
      ]
    },
    {
      "name": "file-attachments",
      "entityType": "feature",
      "observations": [
        "Anhänge nur TRAINING/WETTKAMPF, Whitelist JPEG/PNG/WebP/PDF, 10MB, UUID-Dateinamen; einzige persistierten Dateien (Backup-Tar).",
        "→ apps/treffsicher/docs/requirements.md",
        "→ apps/treffsicher/docs/technical-constraints.md"
      ]
    },
    {
      "name": "dark-mode-only",
      "entityType": "domain-rule",
      "observations": [
        "Ausschließlich Dark Mode, kein Toggle; class=\"dark\" fest auf <html> — bewusste, nicht verhandelbare Design-Entscheidung.",
        "→ apps/treffsicher/docs/technical-constraints.md"
      ]
    },
    {
      "name": "treffsicher-access-model",
      "entityType": "domain-rule",
      "observations": [
        "Keine Selbstregistrierung (Rollen ADMIN/USER, kein MANAGER); strikte Per-User-Isolation via userId (Kontrast zu ringwerk); Seed-Admin via ADMIN_*.",
        "→ apps/treffsicher/docs/requirements.md",
        "→ apps/treffsicher/docs/technical-constraints.md"
      ]
    },
    {
      "name": "treffsicher-dos-protection",
      "entityType": "subsystem",
      "observations": [
        "Login-Rate-Limit 5/E-Mail+30/IP/15min; FormData-Caps (120 Serien, 16KB/Feld); Statistik-Caps (1200 Sessions, 12000 Punkte).",
        "→ apps/treffsicher/docs/technical-constraints.md"
      ]
    },
    {
      "name": "deploy-flow",
      "entityType": "operation",
      "observations": [
        "release (lokal) → build-and-push + ssh-deploy; deploy.sh = pre-backup→pull→up -d→prune; migrate-* one-shot VOR app-*; Tags <sha>(+-migrator).",
        "→ docs/operations.md",
        "→ docs/monorepo-plan.md"
      ]
    },
    {
      "name": "pre-deploy-backup",
      "entityType": "operation",
      "observations": [
        "Auto-Backup VOR jedem Deploy (außer SKIP_BACKUP=1); sichert beide DB-Dumps + treffsicher-Uploads.",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "nightly-backup-cron",
      "entityType": "operation",
      "observations": [
        "./vereinsheim cron, 03:00 UTC, Retention 14 Tage, /var/backups/vereinsheim/; on-VPS (kein Hardware-Schutz).",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "restore-from-backup",
      "entityType": "operation",
      "observations": [
        "./vereinsheim restore (stop→pg_restore --clean→up); Uploads nur treffsicher. Voll-Rollback: erst restore, dann rollback (Reihenfolge!).",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "restore-test",
      "entityType": "operation",
      "observations": [
        "1×/Quartal Backup in Wegwerf-DB restoren + Tabellen zählen — verifiziert, dass Backups funktionieren.",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "failed-migration-recovery",
      "entityType": "operation",
      "observations": [
        "Prisma blockt bis failed-state gelöst; Auto-Recovery known=true/unknown=false (ADR-008); neue Fälle als Handler in KNOWN_RECOVERY_HANDLERS (--applied/--rolled-back).",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "manual-migration-intervention",
      "entityType": "operation",
      "observations": [
        "Diagnose via _prisma_migrations; Pfade A(--applied)/B(--rolled-back)/C(SQL-Fix); Worst-Case = restore aus Pre-Deploy-Backup.",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "image-tag-rollback",
      "entityType": "operation",
      "observations": [
        "./vereinsheim rollback aus deploy-history.log (Tags→.env), SKIP_BACKUP=1; migrate deploy ist no-op (Schema schon korrekt).",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "vps-bootstrap-and-setup",
      "entityType": "operation",
      "observations": [
        "bootstrap-vps.sh (root) → setup-Wizard → cron → DNS → release; SSH-Lockdown manuell (ADR-013); .vereinsheim.local lokal (ADR-012).",
        "→ docs/operations.md",
        "→ README.md"
      ]
    },
    {
      "name": "ops-cli-introspection",
      "entityType": "operation",
      "observations": [
        "./vereinsheim status/env-check/logs/shell/psql/up|down|restart — Diagnose + Service-Steuerung (Wrapper um docker compose, ADR-011).",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "vps-resource-sizing",
      "entityType": "ops-constraint",
      "observations": [
        "RAM ist Engpass: ~0.9GB steady, ~1.85GB Deploy-Spitze; IONOS VPS S (2GB) via mem_limits tragbar, S+ (4GB) empfohlen.",
        "→ docs/spec.md"
      ]
    },
    {
      "name": "off-site-backup-gap",
      "entityType": "ops-constraint",
      "observations": [
        "14-Tage-Lokal-Backups decken keine Hardware-/VPS-Verluste; Off-Site (rclone/borg/Snapshot) ist offene Folge-ADR.",
        "→ docs/decisions.md",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "caddy-tls-volume-critical",
      "entityType": "ops-constraint",
      "observations": [
        "caddy_data hält LE-Zertifikate — Verlust = kein Zugang bis Neu-Ausstellung (ACME-Rate-Limit); bei VPS-Neuaufbau Volume kopieren.",
        "→ docs/operations.md"
      ]
    },
    {
      "name": "migrations-safety-culture",
      "entityType": "ops-constraint",
      "observations": [
        "UNKNOWN-Auto-Resolve NIE true; Daten-Migrationen gegen restorte Prod-Kopie testen; Handler stets kommentieren.",
        "→ docs/operations.md"
      ]
    }
  ],
  "relations": [
    {
      "from": "ringwerk",
      "to": "vereinsheim",
      "relationType": "part_of"
    },
    {
      "from": "treffsicher",
      "to": "vereinsheim",
      "relationType": "part_of"
    },
    {
      "from": "ADR-021",
      "to": "ADR-016",
      "relationType": "amends"
    },
    {
      "from": "ADR-021",
      "to": "ADR-017",
      "relationType": "amends"
    },
    {
      "from": "ADR-020",
      "to": "ADR-018",
      "relationType": "amends"
    },
    {
      "from": "ADR-020",
      "to": "ADR-019",
      "relationType": "amends"
    },
    {
      "from": "competition-types",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "scoring-engine",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "competition-types",
      "to": "scoring-engine",
      "relationType": "uses"
    },
    {
      "from": "factor-correction",
      "to": "scoring-engine",
      "relationType": "applies_to"
    },
    {
      "from": "factor-correction",
      "to": "disciplines-and-factors",
      "relationType": "applies_to"
    },
    {
      "from": "league-mode",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "best-of-single",
      "to": "league-mode",
      "relationType": "feature_of"
    },
    {
      "from": "event-mode",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "season-mode",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "disciplines-and-factors",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "participants-and-enrollment",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "series-unified-model",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "playoffs-knockout-system",
      "to": "league-mode",
      "relationType": "feature_of"
    },
    {
      "from": "meyton-import",
      "to": "league-mode",
      "relationType": "feature_of"
    },
    {
      "from": "pdf-public-urls",
      "to": "ringwerk",
      "relationType": "feature_of"
    },
    {
      "from": "role-based-access",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "audit-logging",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "action-result-convention",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "phase-locking-and-editability",
      "to": "league-mode",
      "relationType": "applies_to"
    },
    {
      "from": "ringwerk-auth-security",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "training-sessions",
      "to": "treffsicher",
      "relationType": "feature_of"
    },
    {
      "from": "result-recording-validation",
      "to": "training-sessions",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-meyton-import",
      "to": "treffsicher",
      "relationType": "subsystem_of"
    },
    {
      "from": "treffsicher-meyton-import",
      "to": "training-sessions",
      "relationType": "feeds"
    },
    {
      "from": "wellbeing-tracking",
      "to": "treffsicher",
      "relationType": "feature_of"
    },
    {
      "from": "mental-modules",
      "to": "treffsicher",
      "relationType": "feature_of"
    },
    {
      "from": "shot-routines",
      "to": "treffsicher",
      "relationType": "subsystem_of"
    },
    {
      "from": "seasonal-goals",
      "to": "treffsicher",
      "relationType": "feature_of"
    },
    {
      "from": "statistics-visualization",
      "to": "treffsicher",
      "relationType": "subsystem_of"
    },
    {
      "from": "file-attachments",
      "to": "treffsicher",
      "relationType": "feature_of"
    },
    {
      "from": "dark-mode-only",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-access-model",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-dos-protection",
      "to": "treffsicher",
      "relationType": "subsystem_of"
    },
    {
      "from": "wellbeing-tracking",
      "to": "statistics-visualization",
      "relationType": "feeds"
    },
    {
      "from": "mental-modules",
      "to": "statistics-visualization",
      "relationType": "feeds"
    },
    {
      "from": "deploy-flow",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "deploy-flow",
      "to": "ADR-015",
      "relationType": "informed_by"
    },
    {
      "from": "pre-deploy-backup",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "pre-deploy-backup",
      "to": "ADR-010",
      "relationType": "informed_by"
    },
    {
      "from": "nightly-backup-cron",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "nightly-backup-cron",
      "to": "ADR-009",
      "relationType": "informed_by"
    },
    {
      "from": "restore-from-backup",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "restore-from-backup",
      "to": "ADR-009",
      "relationType": "informed_by"
    },
    {
      "from": "restore-test",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "failed-migration-recovery",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "failed-migration-recovery",
      "to": "ADR-008",
      "relationType": "informed_by"
    },
    {
      "from": "manual-migration-intervention",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "image-tag-rollback",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "vps-bootstrap-and-setup",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "vps-bootstrap-and-setup",
      "to": "ADR-013",
      "relationType": "informed_by"
    },
    {
      "from": "ops-cli-introspection",
      "to": "vereinsheim",
      "relationType": "operation_of"
    },
    {
      "from": "ops-cli-introspection",
      "to": "ADR-011",
      "relationType": "informed_by"
    },
    {
      "from": "vps-resource-sizing",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "off-site-backup-gap",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "caddy-tls-volume-critical",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "caddy-tls-volume-critical",
      "to": "ADR-004",
      "relationType": "informed_by"
    },
    {
      "from": "migrations-safety-culture",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "migrations-safety-culture",
      "to": "ADR-008",
      "relationType": "informed_by"
    }
  ]
}
