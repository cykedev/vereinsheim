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
        "Doc-Drift (Stand 2026-06-23): CLAUDE.md-Text ('Nächster Schritt: Phase 4') und monorepo-plan.md-Header ('Phase 4 offen') sind veraltet; architecture.md, shared-conventions.md und monorepo-plan §8-Tabelle (Phase 4 Zyklus 1+2 ✅) + Ground Truth (packages/ui|lib existieren) sind die korrekte Quelle.",
        "→ docs/architecture.md#repo-karte"
      ]
    },
    {
      "name": "ringwerk",
      "entityType": "app",
      "observations": [
        "Liga- & Wettkampf-Verwaltung. apps/ringwerk, Dev-Port 3000.",
        "→ docs/architecture.md#routen-überblick"
      ]
    },
    {
      "name": "treffsicher",
      "entityType": "app",
      "observations": [
        "Trainings-App (Tagebuch, Ergebnisse, Statistik, Mentaltraining). apps/treffsicher, Dev-Port 3001, Dark-Mode-only.",
        "→ docs/architecture.md#routen-überblick"
      ]
    },
    {
      "name": "competition-types",
      "entityType": "feature",
      "observations": [
        "Drei Wettbewerbstypen LEAGUE / EVENT / SEASON, teilen die gemeinsame Scoring-Engine; typ-spezifische Flows + Felder.",
        "→ apps/ringwerk/docs/features.md#überblick",
        "→ apps/ringwerk/docs/data-model.md#competitiontype-neu"
      ]
    },
    {
      "name": "scoring-engine",
      "entityType": "subsystem",
      "observations": [
        "7 Wertungsmodi (RINGTEILER/RINGS/RINGS_DECIMAL/TEILER/DECIMAL_REST/TARGET_*) in calculateScore.ts; reine Funktionen, parametrisierte Tests.",
        "→ apps/ringwerk/docs/features.md#wertungsmodi-scoring-engine"
      ]
    },
    {
      "name": "factor-correction",
      "entityType": "domain-rule",
      "observations": [
        "Teiler × Disziplin.teilerFaktor — greift NUR bei gemischten Wettbewerben (Competition.disciplineId === null), sonst Faktor 1.0; zentralisiert via effectiveTeilerFaktor(), nicht rückwirkend.",
        "→ apps/ringwerk/docs/features.md#gemeinsame-konfiguration",
        "→ apps/ringwerk/docs/data-model.md#faktor-korrektur"
      ]
    },
    {
      "name": "league-mode",
      "entityType": "feature",
      "observations": [
        "Formate DOUBLE_ROUND_ROBIN oder BEST_OF_SINGLE; Circle-Method-Spielplan (Freilos=2 Pkt), optionale Playoffs.",
        "→ apps/ringwerk/docs/features.md#liga-modus-league"
      ]
    },
    {
      "name": "best-of-single",
      "entityType": "feature",
      "observations": [
        "Liga-Gruppenphase mit N Duellen je Begegnung (groupBestOf, default 3); Stechschuss bei Gleichstand (siehe Incident stechschuss-modell-flip).",
        "→ apps/ringwerk/docs/features.md#liga-modus-best-of-single-implementiert"
      ]
    },
    {
      "name": "event-mode",
      "entityType": "feature",
      "observations": [
        "Einmaliges Event; eine Serie je TN; Gastschützen + TARGET-Modi + Team-Events (SUM/BEST) möglich.",
        "→ apps/ringwerk/docs/features.md#event-modus-event-implementiert-phase-4"
      ]
    },
    {
      "name": "season-mode",
      "entityType": "feature",
      "observations": [
        "Langzeit; beste Serien zählen, Mehrfach-Ranking (Ringe/Teiler/Ringteiler), Mindestserien-Gate (minSeries default 20).",
        "→ apps/ringwerk/docs/features.md#saison-modus-season-implementiert-phase-5"
      ]
    },
    {
      "name": "disciplines-and-factors",
      "entityType": "feature",
      "observations": [
        "System-Disziplinen LP/LG/LPA/LGA mit teilerFaktor; WHOLE vs. DECIMAL; Archivierung statt Löschen bei vorhandenen Ergebnissen.",
        "→ apps/ringwerk/docs/data-model.md#disziplin-discipline",
        "→ apps/ringwerk/docs/features.md#disziplinen"
      ]
    },
    {
      "name": "participants-and-enrollment",
      "entityType": "feature",
      "observations": [
        "Teilnehmerpool + Einschreibung pro Wettbewerb (CompetitionParticipant, Status ACTIVE/WITHDRAWN); Gäste nur bei Events.",
        "→ apps/ringwerk/docs/features.md#teilnehmerverwaltung",
        "→ apps/ringwerk/docs/data-model.md#wettbewerbs-teilnehmer-competitionparticipant-ersetzt-leagueparticipant"
      ]
    },
    {
      "name": "series-unified-model",
      "entityType": "subsystem",
      "observations": [
        "Universelle Ergebniseinheit (ersetzte MatchResult): rings/teiler/disciplineId/duelNumber/isTiebreak/isGuest, verknüpft via competitionParticipantId + optional matchupId.",
        "→ apps/ringwerk/docs/data-model.md#serie-series-ersetzt-matchresult"
      ]
    },
    {
      "name": "playoffs-knockout-system",
      "entityType": "feature",
      "observations": [
        "Liga-K.o. nach Gruppenphase, Best-of-N (playoffBestOf), eigenes Finale-Format; playoffMatch.count>0 sperrt Edits (siehe ruleset-lock-granularity).",
        "→ apps/ringwerk/docs/features.md#playoff-phase-ko-system"
      ]
    },
    {
      "name": "meyton-import",
      "entityType": "feature",
      "observations": [
        "Ergebnisübernahme aus Meyton via URL/PDF, nur Liga; textbasiert (kein OCR), DoS-Grenzen (2MB/Stream, 8MB, 10MB/15s URL).",
        "→ apps/ringwerk/docs/features.md#meyton-import"
      ]
    },
    {
      "name": "pdf-public-urls",
      "entityType": "feature",
      "observations": [
        "isPublic→publicSlug für /api/public/c/<slug>/pdf (unauth); partieller Unique-Index, optional bcrypt-PW, 24h-Cache (tagged by slug).",
        "→ apps/ringwerk/docs/features.md#öffentliche-pdf-url-website-verlinkung"
      ]
    },
    {
      "name": "role-based-access",
      "entityType": "subsystem",
      "observations": [
        "Rollen ADMIN/MANAGER/USER, vereinsweite Sichtbarkeit (KEIN userId-Filter) — Kontrast zu treffsicher (per-User). Auth via proxy.ts + Layout-Guards.",
        "→ apps/ringwerk/docs/architecture.md#appadminlayouttsx-rollen-guard",
        "→ apps/ringwerk/docs/code-conventions.md#nutzer-rolle"
      ]
    },
    {
      "name": "audit-logging",
      "entityType": "subsystem",
      "observations": [
        "Protokolliert Verwaltungsaktionen (USER_/PARTICIPANT_/…/DESTRUCTIVE), competitionId-FK, Details-JSON-Snapshot; macht FORCE_DELETE nachvollziehbar.",
        "→ apps/ringwerk/docs/data-model.md#audit-log",
        "→ apps/ringwerk/docs/features.md#audit-log-protokoll"
      ]
    },
    {
      "name": "action-result-convention",
      "entityType": "subsystem",
      "observations": [
        "Ringwerk-Kanon (Zielform für treffsicher): { success:true; data?:T } | { error: string|Record<string,string[]> }; Zod + useActionState. Siehe treffsicher-actionresult-migration.",
        "→ docs/shared-conventions.md#6-daten-formatierung",
        "→ apps/ringwerk/docs/code-conventions.md#actionresult"
      ]
    },
    {
      "name": "phase-locking-and-editability",
      "entityType": "domain-rule",
      "observations": [
        "Liga-Edits gesperrt ab Spielplan (matchupCount>0); Playoff-Settings bis Playoff-Start (playoffMatch.count>0) — Granularität an Wirk-Zeitpunkt (ruleset-lock-granularity).",
        "→ apps/ringwerk/docs/features.md#konfiguration"
      ]
    },
    {
      "name": "ringwerk-auth-security",
      "entityType": "subsystem",
      "observations": [
        "NextAuth v4 + bcrypt; Login-Rate-Limit 5/E-Mail, 30/IP, 15min; Seed-Admin via SEED_ADMIN_* (treffsicher: ADMIN_*, Angleichung offen).",
        "→ apps/ringwerk/docs/technical.md#authentifizierung-sicherheit",
        "→ apps/ringwerk/docs/architecture.md#auth-strategie"
      ]
    },
    {
      "name": "training-sessions",
      "entityType": "feature",
      "observations": [
        "Session-zentrisch, 4 Typen TRAINING/WETTKAMPF/TROCKENTRAINING/MENTAL; nur TRAINING/WETTKAMPF mit Serien/Anhängen/Mental-Modulen.",
        "→ apps/treffsicher/docs/requirements.md#die-einheit-herzstück-des-systems",
        "→ apps/treffsicher/docs/data-model.md#datenmodell-verbindlich"
      ]
    },
    {
      "name": "result-recording-validation",
      "entityType": "domain-rule",
      "observations": [
        "Ganzringe 0–10, Zehntelringe 0.0 oder 1.0–10.9 (0.1–0.9 ungültig); Probe zählt nicht; Ausführungsqualität 1–5 je Serie.",
        "→ apps/treffsicher/docs/requirements.md#validierung-der-eingabewerte"
      ]
    },
    {
      "name": "treffsicher-meyton-import",
      "entityType": "subsystem",
      "observations": [
        "Meyton-Import im Einheit-Formular (URL/Datei), textbasiert, ersetzt Formular-Serien; DoS-Härtung (10MB/15s, 2MB/Stream, 8MB, 25k Tokens).",
        "→ apps/treffsicher/docs/requirements.md#meyton-pdf-import-trainingwettkampf",
        "→ apps/treffsicher/docs/technical-constraints.md#datei-uploads"
      ]
    },
    {
      "name": "wellbeing-tracking",
      "entityType": "feature",
      "observations": [
        "Befinden vor der Einheit (Schlaf/Energie/Stress/Motivation 0–100), optional; fließt in Statistik-Korrelation.",
        "→ apps/treffsicher/docs/requirements.md#befinden-tracking"
      ]
    },
    {
      "name": "mental-modules",
      "entityType": "feature",
      "observations": [
        "Reflexion/Prognose/Feedback je Einheit; 7 Dimensionen (Kondition…Material 0–100); nur TRAINING/WETTKAMPF.",
        "→ apps/treffsicher/docs/requirements.md#prognose-feedback-wettkampf-und-fokussiertes-training"
      ]
    },
    {
      "name": "shot-routines",
      "entityType": "subsystem",
      "observations": [
        "Eigenständiges Routine-Dokument (geordnete Schritte, pro Nutzer, optional Disziplin); Einheiten verknüpfen + Abweichungen notieren.",
        "→ apps/treffsicher/docs/requirements.md#schuss-ablauf"
      ]
    },
    {
      "name": "seasonal-goals",
      "entityType": "feature",
      "observations": [
        "Zeitraum-Ziele (RESULT/PROCESS), frei wählbarer Zeitraum, M:N zu Sessions.",
        "→ apps/treffsicher/docs/requirements.md#saisonziele"
      ]
    },
    {
      "name": "statistics-visualization",
      "entityType": "subsystem",
      "observations": [
        "Konfigurierbare Zeiträume + Filter (nie gemischte Disziplinen); 7 Ansichten inkl. 7D-Radar; Meyton-Farbschema.",
        "→ apps/treffsicher/docs/requirements.md#statistiken-auswertung"
      ]
    },
    {
      "name": "file-attachments",
      "entityType": "feature",
      "observations": [
        "Anhänge nur TRAINING/WETTKAMPF, Whitelist JPEG/PNG/WebP/PDF, 10MB, UUID-Dateinamen; einzige persistierten Dateien (Backup-Tar).",
        "→ apps/treffsicher/docs/requirements.md#dateien-bilder",
        "→ apps/treffsicher/docs/technical-constraints.md#datei-uploads"
      ]
    },
    {
      "name": "dark-mode-only",
      "entityType": "domain-rule",
      "observations": [
        "Ausschließlich Dark Mode, kein Toggle; class=\"dark\" fest auf <html> — bewusste, nicht verhandelbare Design-Entscheidung.",
        "→ apps/treffsicher/docs/technical-constraints.md#design-ui"
      ]
    },
    {
      "name": "treffsicher-access-model",
      "entityType": "domain-rule",
      "observations": [
        "Keine Selbstregistrierung (Rollen ADMIN/USER, kein MANAGER); strikte Per-User-Isolation via userId (Kontrast zu ringwerk); Seed-Admin via ADMIN_*.",
        "→ apps/treffsicher/docs/requirements.md#nutzerverwaltung-sicherheit",
        "→ apps/treffsicher/docs/technical-constraints.md#authentifizierung-sicherheit"
      ]
    },
    {
      "name": "treffsicher-dos-protection",
      "entityType": "subsystem",
      "observations": [
        "Login-Rate-Limit 5/E-Mail+30/IP/15min; FormData-Caps (120 Serien, 16KB/Feld); Statistik-Caps (1200 Sessions, 12000 Punkte).",
        "→ apps/treffsicher/docs/technical-constraints.md#dos-schutz-verbindlich"
      ]
    },
    {
      "name": "deploy-flow",
      "entityType": "operation",
      "observations": [
        "release (lokal) → build-and-push + ssh-deploy; deploy.sh = pre-backup→pull→up -d→prune; migrate-* one-shot VOR app-*; Tags <sha>(+-migrator).",
        "→ docs/operations.md#standard-flow",
        "→ docs/monorepo-plan.md#7-deploy-bleibt-vertragsgleich-live-ohne-probleme"
      ]
    },
    {
      "name": "pre-deploy-backup",
      "entityType": "operation",
      "observations": [
        "Auto-Backup VOR jedem Deploy (außer SKIP_BACKUP=1); sichert beide DB-Dumps + treffsicher-Uploads.",
        "→ docs/operations.md#pre-deploy-backup-eingebaut"
      ]
    },
    {
      "name": "nightly-backup-cron",
      "entityType": "operation",
      "observations": [
        "./vereinsheim cron, 03:00 UTC, Retention 14 Tage, /var/backups/vereinsheim/; on-VPS (kein Hardware-Schutz).",
        "→ docs/operations.md#wann-läuft-backup"
      ]
    },
    {
      "name": "restore-from-backup",
      "entityType": "operation",
      "observations": [
        "./vereinsheim restore (stop→pg_restore --clean→up); Uploads nur treffsicher. Voll-Rollback: erst restore, dann rollback (Reihenfolge!).",
        "→ docs/operations.md#recovery-aus-backup-gleicher-vps"
      ]
    },
    {
      "name": "restore-test",
      "entityType": "operation",
      "observations": [
        "1×/Quartal Backup in Wegwerf-DB restoren + Tabellen zählen — verifiziert, dass Backups funktionieren.",
        "→ docs/operations.md#restore-test-regelmäßig-empfohlen"
      ]
    },
    {
      "name": "failed-migration-recovery",
      "entityType": "operation",
      "observations": [
        "Prisma blockt bis failed-state gelöst; Auto-Recovery known=true/unknown=false (ADR-008); neue Fälle als Handler in KNOWN_RECOVERY_HANDLERS (--applied/--rolled-back).",
        "→ docs/operations.md#eingebauter-recovery-mechanismus"
      ]
    },
    {
      "name": "manual-migration-intervention",
      "entityType": "operation",
      "observations": [
        "Diagnose via _prisma_migrations; Pfade A(--applied)/B(--rolled-back)/C(SQL-Fix); Worst-Case = restore aus Pre-Deploy-Backup.",
        "→ docs/operations.md#pfad-3-manueller-eingriff-in-der-db"
      ]
    },
    {
      "name": "image-tag-rollback",
      "entityType": "operation",
      "observations": [
        "./vereinsheim rollback aus deploy-history.log (Tags→.env), SKIP_BACKUP=1; migrate deploy ist no-op (Schema schon korrekt).",
        "→ docs/operations.md#variante-a-image-tag-rollback-schema-unverändert"
      ]
    },
    {
      "name": "vps-bootstrap-and-setup",
      "entityType": "operation",
      "observations": [
        "bootstrap-vps.sh (root) → setup-Wizard → cron → DNS → release; SSH-Lockdown manuell (ADR-013); .vereinsheim.local lokal (ADR-012).",
        "→ docs/operations.md#initial-bootstrap-eines-neuen-vps"
      ]
    },
    {
      "name": "ops-cli-introspection",
      "entityType": "operation",
      "observations": [
        "./vereinsheim status/env-check/logs/shell/psql/up|down|restart — Diagnose + Service-Steuerung (Wrapper um docker compose, ADR-011).",
        "→ docs/operations.md#das-werkzeug-scriptsvereinsheim"
      ]
    },
    {
      "name": "vps-resource-sizing",
      "entityType": "ops-constraint",
      "observations": [
        "RAM ist Engpass: ~0.9GB steady, ~1.85GB Deploy-Spitze; IONOS VPS S (2GB) via mem_limits tragbar, S+ (4GB) empfohlen.",
        "→ docs/spec.md#vps-sizing"
      ]
    },
    {
      "name": "off-site-backup-gap",
      "entityType": "ops-constraint",
      "observations": [
        "14-Tage-Lokal-Backups decken keine Hardware-/VPS-Verluste; Off-Site (rclone/borg/Snapshot) ist offene Folge-ADR.",
        "→ docs/operations.md#was-wird-gesichert",
        "→ docs/decisions.md#mögliche-folge-adrs-out-of-scope-aber-vorgesehen"
      ]
    },
    {
      "name": "caddy-tls-volume-critical",
      "entityType": "ops-constraint",
      "observations": [
        "caddy_data hält LE-Zertifikate — Verlust = kein Zugang bis Neu-Ausstellung (ACME-Rate-Limit); bei VPS-Neuaufbau Volume kopieren.",
        "→ docs/spec.md#zielarchitektur"
      ]
    },
    {
      "name": "migrations-safety-culture",
      "entityType": "ops-constraint",
      "observations": [
        "UNKNOWN-Auto-Resolve NIE true; Daten-Migrationen gegen restorte Prod-Kopie testen; Handler stets kommentieren.",
        "→ docs/operations.md#operative-empfehlungen"
      ]
    },
    {
      "name": "data-flow-principle",
      "entityType": "subsystem",
      "observations": [
        "Kanonischer Datenfluss: Formular → useActionState → Server Action (Auth→Zod→db→revalidatePath→ActionResult); Lesen via lib/<feature>/queries.ts in Server Components.",
        "apps/ringwerk/docs/architecture.md#datenflussprinzip"
      ]
    },
    {
      "name": "feature-module-layout",
      "entityType": "subsystem",
      "observations": [
        "Feature-Modul lib/<feature>/ folgt festem Muster: actions.ts (Server Actions), queries.ts (reine DB-Lesefunktionen), plus Komponenten/Schema je Feature.",
        "apps/ringwerk/docs/architecture.md#lib-module",
        "apps/ringwerk/docs/architecture.md#verzeichnisstruktur"
      ]
    },
    {
      "name": "server-action-pattern",
      "entityType": "domain-rule",
      "observations": [
        "Server Actions in actions.ts des Feature-Ordners, Aufbau immer Auth → Validierung → DB; Mutationen statt API Routes.",
        "apps/ringwerk/docs/code-conventions.md#server-actions"
      ]
    },
    {
      "name": "prisma7-conventions",
      "entityType": "subsystem",
      "observations": [
        "Prisma-7-Abweichungen: generierter Client unter src/generated/prisma/, kein url-Feld in datasource (prisma.config.ts), DB via @prisma/adapter-pg mit pg.Pool.",
        "apps/ringwerk/docs/technical.md#prisma-7-kritische-abweichungen"
      ]
    },
    {
      "name": "club-wide-data-rule",
      "entityType": "domain-rule",
      "observations": [
        "Kein userId-Filter auf Fachdaten — alle Daten vereinsweit sichtbar; Zugangskontrolle ausschließlich über Rolle.",
        "apps/ringwerk/docs/project-brief.md#core-rules-non-negotiable"
      ]
    },
    {
      "name": "permission-matrix",
      "entityType": "domain-rule",
      "observations": [
        "Berechtigungsmatrix pro Aktion über ADMIN/MANAGER/USER; MANAGER darf alles Fachliche, aber kein /admin/* (Nutzerverwaltung nur ADMIN).",
        "apps/ringwerk/docs/features.md#berechtigungsmatrix"
      ]
    },
    {
      "name": "league-points-and-tiebreak",
      "entityType": "domain-rule",
      "observations": [
        "Liga-Gruppenphase-Punktevergabe (Sieg 2 / Unentschieden je 1 / Freilos 2) als Basis der Tabellensortierung im DOUBLE_ROUND_ROBIN.",
        "apps/ringwerk/docs/data-model.md#liga-spezifisch-punktevergabe-gruppenphase"
      ]
    },
    {
      "name": "event-teams",
      "entityType": "feature",
      "observations": [
        "EventTeam — Team-Klammer in Team-Events (teamNumber, Mitglieder via eventTeamId); nur bei EVENT mit teamSize ≥ 2.",
        "apps/ringwerk/docs/data-model.md#team-im-event-eventteam"
      ]
    },
    {
      "name": "color-semantics",
      "entityType": "domain-rule",
      "observations": [
        "Farbpalette als Bedeutungsträger: Grün=Sieg/abgeschlossen, Gelb/Silber/Orange=Platz 1/2/3, Amber=Unentschieden, Destructive=Löschen, Muted=neutral.",
        "apps/ringwerk/docs/ui-patterns.md#farbpalette-bedeutungsträger"
      ]
    },
    {
      "name": "row-action-pattern",
      "entityType": "domain-rule",
      "observations": [
        "Listenzeilen mit Inline-Aktions-Buttons (nie Dropdown), AlertDialog statt confirm() für Destruktives, Bearbeiten als Inline-Dialog.",
        "apps/ringwerk/docs/ui-patterns.md#listen-mit-zeilenaktionen"
      ]
    },
    {
      "name": "void-match-rendering",
      "entityType": "domain-rule",
      "observations": [
        "Void-Matches (Paarung mit zurückgezogenem TN, isVoid) ausgegraut/durchgestrichen gerendert, ohne Ergebnis und ohne Gewinner-Hervorhebung.",
        "apps/ringwerk/docs/ui-patterns.md#spielplan-void-matches-rückzug"
      ]
    },
    {
      "name": "ringwerk-testing-conventions",
      "entityType": "subsystem",
      "observations": [
        "Vitest-Tests neben dem Code; Pflicht-Abdeckung primär für Scoring-/Domänenlogik (calculate*), Arrange-Act-Assert.",
        "apps/ringwerk/docs/code-conventions.md#testing"
      ]
    },
    {
      "name": "training-session-types",
      "entityType": "domain-rule",
      "observations": [
        "Vier Einheitentypen TRAINING/WETTKAMPF/TROCKEN/MENTAL; Anhänge, Prognose/Feedback und Ergebniserfassung nur bei TRAINING+WETTKAMPF — serverseitig erzwungen.",
        "apps/treffsicher/docs/requirements.md#einheitentypen",
        "apps/treffsicher/docs/technical-constraints.md#verbindliche-konsistenzregeln-fachlich-technisch"
      ]
    },
    {
      "name": "treffsicher-disciplines",
      "entityType": "feature",
      "observations": [
        "Frei konfigurierbare Disziplinen je Nutzer (Wertungsart Ganz/Zehntel, Serien-/Schussparameter); Löschverhalten + vorinstallierte Standarddisziplinen.",
        "apps/treffsicher/docs/data-model.md#disziplinen",
        "apps/treffsicher/docs/requirements.md#disziplinen"
      ]
    },
    {
      "name": "treffsicher-user-isolation",
      "entityType": "domain-rule",
      "observations": [
        "Per-User-Datenisolation: jede Prisma-Query filtert zwingend where:{ userId }; kein direkter Prisma-Zugriff in Komponenten.",
        "apps/treffsicher/docs/code-conventions.md#datenbankzugriffe-prisma",
        "apps/treffsicher/docs/requirements.md#vereinsbetrieb"
      ]
    },
    {
      "name": "treffsicher-server-actions",
      "entityType": "domain-rule",
      "observations": [
        "Server Actions statt API Routes; je Feature actions.ts, strukturierte Fehler-Rückgaben statt throw. Next-Regel: 'use server' exportiert nur direkt deklarierte async-Funktionen.",
        "apps/treffsicher/docs/code-conventions.md#server-actions",
        "apps/treffsicher/docs/technical-constraints.md#daten-und-aktionsarchitektur"
      ]
    },
    {
      "name": "treffsicher-modularity-rules",
      "entityType": "domain-rule",
      "observations": [
        "Dünne Orchestrator-Dateien, 220-Zeilen-Split-Regel, Props-Budget, einheitliche Feature-Struktur, Duplikations-Sicherheitsnetz — verbindlich für neuen/geänderten Code.",
        "apps/treffsicher/docs/technical-constraints.md#modularität-wartbarkeit-verbindlich"
      ]
    },
    {
      "name": "treffsicher-testing-conventions",
      "entityType": "domain-rule",
      "observations": [
        "Vitest-Setup; getestet werden Validierung/Geschäftslogik/Server-Actions (Arrange-Act-Assert), nicht reines UI/Framework.",
        "apps/treffsicher/docs/code-conventions.md#testing"
      ]
    },
    {
      "name": "treffsicher-tech-stack",
      "entityType": "subsystem",
      "observations": [
        "Stack: Next.js 16, Prisma 7, NextAuth v4, Zod v4, React 19 useActionState; bcrypt; Migrationen via prisma migrate deploy beim App-Start.",
        "apps/treffsicher/docs/technical-constraints.md#tech-stack-verbindlich",
        "apps/treffsicher/docs/technical-constraints.md#prisma-7-wichtige-abweichungen-von-früheren-versionen"
      ]
    },
    {
      "name": "treffsicher-pwa-offline",
      "entityType": "state",
      "observations": [
        "OFFEN (Phase 5.2 / Backlog T-06): kein Service Worker/Manifest; geplant next-pwa, Offline-Fallback, IndexedDB-Sync zum Erfassen ohne Verbindung am Schießstand.",
        "apps/treffsicher/docs/implementation-plan.md#phase-52-pwa-offline-unterstützung-offen",
        "apps/treffsicher/docs/backlog.md#t-06-pwa-offline-unterstützung-phase-52"
      ]
    },
    {
      "name": "repo-architecture-map",
      "entityType": "subsystem",
      "observations": [
        "High-Level-Karte des Monorepos (apps/*, packages/config|lib|ui, docs/, .claude/, compose/Caddy/db-init). Schnelle Orientierung, kein Vollindex.",
        "docs/architecture.md#repo-karte"
      ]
    },
    {
      "name": "build-deploy-pipeline",
      "entityType": "subsystem",
      "observations": [
        "Lokaler Build aus dem Monorepo (turbo prune → Root-Dockerfile → Docker Hub), VPS pullt; migrate-* vor app-*; Caddy terminiert TLS, proxyt zwei Subdomains.",
        "docs/architecture.md#build-deploy-adr-005006007015"
      ]
    },
    {
      "name": "network-segmentation",
      "entityType": "ops-constraint",
      "observations": [
        "Zwei Docker-Netze web {caddy, app-*} und data {db, app-*, migrate-*}; db NICHT im web-Netz — kein direkter Außenkontakt zur DB.",
        "docs/architecture.md#build-deploy-adr-005006007015"
      ]
    },
    {
      "name": "db-isolation-model",
      "entityType": "ops-constraint",
      "observations": [
        "Ein Postgres-Container, zwei DBs + zwei Owner-User (ringwerk, treffsicher); Cross-DB-Zugriff technisch unmöglich.",
        "docs/architecture.md#build-deploy-adr-005006007015"
      ]
    },
    {
      "name": "caddy-reverse-proxy",
      "entityType": "subsystem",
      "observations": [
        "Caddy als Reverse Proxy, terminiert TLS (Let's Encrypt, Auto-Renew) und proxyt ringwerk.<domain>/treffsicher.<domain> auf die App-Container.",
        "docs/spec.md#zielarchitektur"
      ]
    },
    {
      "name": "target-architecture",
      "entityType": "subsystem",
      "observations": [
        "Zielarchitektur: Container-Topologie, Netze, Volumes (caddy_data/postgres_data/uploads), Subdomain-Routing — das Soll-Bild des Prod-Deploys.",
        "docs/spec.md#zielarchitektur"
      ]
    },
    {
      "name": "component-canon",
      "entityType": "domain-rule",
      "observations": [
        "Komponenten-Kanon beider Apps: PageHeader/DetailActionBar (keine Dropdown-Objektaktionen), EmptyState, ConfirmDialog (nie native confirm), FieldError, sonner-Toasts, Unsaved-Changes-Guard.",
        "docs/shared-conventions.md#2-komponenten-kanon"
      ]
    },
    {
      "name": "typography-layout-rules",
      "entityType": "domain-rule",
      "observations": [
        "Seitentitel text-2xl font-semibold tracking-tight (nicht bold), Untertitel text-sm muted; Unicode-Ellipsis statt ASCII; App-Shell mx-auto max-w-6xl px-4 py-8.",
        "docs/shared-conventions.md#3-typografie-layout"
      ]
    },
    {
      "name": "icon-vocabulary",
      "entityType": "domain-rule",
      "observations": [
        "Festes lucide-react-Icon-Vokabular (Target=Disziplinen, Pencil=Bearbeiten, Trash2=Löschen …); Marken-Logos: Treffsicher=Crosshair, Ringwerk=CircleDot.",
        "docs/shared-conventions.md#4-icon-vokabular-lucide-react"
      ]
    },
    {
      "name": "navigation-pattern",
      "entityType": "domain-rule",
      "observations": [
        "Hamburger-Schema beider Apps: Desktop hidden md:flex-Links + Logo links, Konto als UserCircle-Dropdown rechts; Mobil border-t md:hidden Nav.",
        "docs/shared-conventions.md#5-navigation"
      ]
    },
    {
      "name": "data-formatting-rules",
      "entityType": "domain-rule",
      "observations": [
        "Datum/Zeit/Zahl über @vereinsheim/lib/dateTime (kein inline Intl), TZ-Default Europe/Berlin; ActionResult-Kanon als diskriminierte Union (Ringwerk-Muster).",
        "docs/shared-conventions.md#6-daten-formatierung"
      ]
    },
    {
      "name": "drift-protection",
      "entityType": "ops-constraint",
      "observations": [
        "Drift-Schutz: 5 Quality-Gates (lint/format/test/tsc/next build) vor jedem Commit + consistency-check.sh als fatales Release-Gate; Shared-Schicht in @vereinsheim/{ui,lib,config}.",
        "docs/shared-conventions.md#8-drift-schutz-prozess"
      ]
    },
    {
      "name": "monorepo-fast-build",
      "entityType": "subsystem",
      "observations": [
        "Build-Hebel des Monorepos: Turbo-Task-Cache, turbo prune --docker (cache-stabiler Kontext pro App), BuildKit-Cache-Mount auf pnpm-Store, --filter='[HEAD^1]'.",
        "docs/monorepo-plan.md#4-der-schnelle-build"
      ]
    },
    {
      "name": "monorepo-migration-phases",
      "entityType": "subsystem",
      "observations": [
        "Phasenplan der Monorepo-Migration: Phase 1 apps/*, 2 packages/config, 3 Build aus Monorepo, 4 packages/lib+ui; Phase 5 CI/Remote-Cache offen.",
        "docs/monorepo-plan.md#8-migration-in-phasen-jederzeit-lauffähig"
      ]
    },
    {
      "name": "treffsicher-backlog",
      "entityType": "state",
      "observations": [
        "OFFEN: priorisierter Themenkatalog (Code-Review 2026-03-31). P1 String-Längen-Limits Freitext (T-01); P2 React-Error-Boundaries (T-05) + ActionResult-Generic-Typ (T-08, siehe treffsicher-actionresult-migration); P3 Pflicht-Splits >220 Zeilen (T-02 mentalActions, T-03 shared, T-04 StatisticsCharts); P4 PWA (T-06, siehe treffsicher-pwa-offline), maxLength-UI (T-07), Props-Budget GoalAssignmentsForm (T-09), Tippfehler (T-10). Gestrichen/nicht empfohlen: CSV-Export, A11y-Audit, strukturiertes Logging, E2E.",
        "→ apps/treffsicher/docs/backlog.md#backlog-treffsicher-stand-2026-03-31"
      ]
    },
    {
      "name": "treffsicher-future-features",
      "entityType": "state",
      "observations": [
        "OFFEN (spätere Phasen, fachlich): Offline-Erfassung am Schießstand (siehe treffsicher-pwa-offline), Trockentraining als vollständig eigener Einheitentyp mit spezifischen Feldern, Mustererkennung/smarte Auswertungen ('wie schieße ich nach schlechtem Schlaf?'), Trainer-Zugang (read-only, eingeschränkt).",
        "→ apps/treffsicher/docs/requirements.md#offene-punkte-spätere-phasen"
      ]
    },
    {
      "name": "monorepo-phase-5",
      "entityType": "state",
      "observations": [
        "OFFEN (optional): Phase 5 der Monorepo-Migration — CI via GitHub Actions (baut + pusht, optional Deploy-Trigger via SSH/Webhook) + Turbo-Remote-Cache; macht ADR-006 (lokaler Build/Push) obsolet.",
        "→ docs/monorepo-plan.md#12-offene-folgepunkte-nicht-in-dieser-migration"
      ]
    },
    {
      "name": "env-var-alignment-gap",
      "entityType": "state",
      "observations": [
        "OFFEN: Seed-Admin-Env-Vars der beiden Apps angleichen (treffsicher ADMIN_* ↔ ringwerk SEED_ADMIN_*); deploy-breaking, daher als separater Schritt geführt.",
        "→ docs/monorepo-plan.md#12-offene-folgepunkte-nicht-in-dieser-migration"
      ]
    },
    {
      "name": "dependency-pin-alignment",
      "entityType": "state",
      "observations": [
        "OFFEN (Drift-Schutz): Dependency-Pins zwischen den Apps angleichen, inkl. TypeScript-Major; Dependency-Drift ist aktuell nur warnend im consistency-check, nicht fatal.",
        "→ docs/shared-conventions.md#8-drift-schutz-prozess"
      ]
    },
    {
      "name": "future-adrs",
      "entityType": "state",
      "observations": [
        "VORGESEHEN (out-of-scope, je eigener Folge-ADR ab ADR-021+ wenn aktuell): Monitoring/Alerting (Uptime-Kuma/Prometheus+Grafana), Staging-Umgebung (Schema-Migrationstests vor Prod), WAF/Fail2ban (höhere Exposition), generisches App-Template ab ~3–4 Apps. (Off-Site-Backup → off-site-backup-gap, CI/CD → monorepo-phase-5.)",
        "→ docs/decisions.md#mögliche-folge-adrs-out-of-scope-aber-vorgesehen"
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
      "from": "ADR-022",
      "to": "ADR-016",
      "relationType": "amends"
    },
    {
      "from": "ADR-022",
      "to": "ADR-021",
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
    },
    {
      "from": "data-flow-principle",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "feature-module-layout",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "server-action-pattern",
      "to": "ringwerk",
      "relationType": "applies_to"
    },
    {
      "from": "prisma7-conventions",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "club-wide-data-rule",
      "to": "ringwerk",
      "relationType": "applies_to"
    },
    {
      "from": "permission-matrix",
      "to": "ringwerk",
      "relationType": "applies_to"
    },
    {
      "from": "permission-matrix",
      "to": "role-based-access",
      "relationType": "relates_to"
    },
    {
      "from": "league-points-and-tiebreak",
      "to": "league-mode",
      "relationType": "applies_to"
    },
    {
      "from": "event-teams",
      "to": "event-mode",
      "relationType": "feature_of"
    },
    {
      "from": "color-semantics",
      "to": "ringwerk",
      "relationType": "applies_to"
    },
    {
      "from": "row-action-pattern",
      "to": "ringwerk",
      "relationType": "applies_to"
    },
    {
      "from": "void-match-rendering",
      "to": "ringwerk",
      "relationType": "applies_to"
    },
    {
      "from": "ringwerk-testing-conventions",
      "to": "ringwerk",
      "relationType": "subsystem_of"
    },
    {
      "from": "training-session-types",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "training-session-types",
      "to": "training-sessions",
      "relationType": "relates_to"
    },
    {
      "from": "treffsicher-disciplines",
      "to": "treffsicher",
      "relationType": "feature_of"
    },
    {
      "from": "treffsicher-user-isolation",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-user-isolation",
      "to": "treffsicher-access-model",
      "relationType": "relates_to"
    },
    {
      "from": "treffsicher-server-actions",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-modularity-rules",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-testing-conventions",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-tech-stack",
      "to": "treffsicher",
      "relationType": "subsystem_of"
    },
    {
      "from": "treffsicher-pwa-offline",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "repo-architecture-map",
      "to": "vereinsheim",
      "relationType": "subsystem_of"
    },
    {
      "from": "build-deploy-pipeline",
      "to": "vereinsheim",
      "relationType": "subsystem_of"
    },
    {
      "from": "build-deploy-pipeline",
      "to": "ADR-007",
      "relationType": "governed_by"
    },
    {
      "from": "network-segmentation",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "network-segmentation",
      "to": "ADR-003",
      "relationType": "governed_by"
    },
    {
      "from": "db-isolation-model",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "db-isolation-model",
      "to": "ADR-002",
      "relationType": "governed_by"
    },
    {
      "from": "caddy-reverse-proxy",
      "to": "vereinsheim",
      "relationType": "subsystem_of"
    },
    {
      "from": "caddy-reverse-proxy",
      "to": "ADR-004",
      "relationType": "governed_by"
    },
    {
      "from": "target-architecture",
      "to": "vereinsheim",
      "relationType": "subsystem_of"
    },
    {
      "from": "component-canon",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "typography-layout-rules",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "icon-vocabulary",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "navigation-pattern",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "data-formatting-rules",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "drift-protection",
      "to": "vereinsheim",
      "relationType": "constraint_of"
    },
    {
      "from": "monorepo-fast-build",
      "to": "vereinsheim",
      "relationType": "subsystem_of"
    },
    {
      "from": "monorepo-fast-build",
      "to": "ADR-015",
      "relationType": "governed_by"
    },
    {
      "from": "monorepo-migration-phases",
      "to": "vereinsheim",
      "relationType": "subsystem_of"
    },
    {
      "from": "monorepo-migration-phases",
      "to": "ADR-015",
      "relationType": "governed_by"
    },
    {
      "from": "role-based-access",
      "to": "treffsicher-access-model",
      "relationType": "contrasts_with"
    },
    {
      "from": "club-wide-data-rule",
      "to": "treffsicher-user-isolation",
      "relationType": "contrasts_with"
    },
    {
      "from": "meyton-import",
      "to": "treffsicher-meyton-import",
      "relationType": "relates_to"
    },
    {
      "from": "ringwerk-auth-security",
      "to": "treffsicher-dos-protection",
      "relationType": "relates_to"
    },
    {
      "from": "server-action-pattern",
      "to": "treffsicher-server-actions",
      "relationType": "relates_to"
    },
    {
      "from": "ringwerk-testing-conventions",
      "to": "treffsicher-testing-conventions",
      "relationType": "relates_to"
    },
    {
      "from": "action-result-convention",
      "to": "data-formatting-rules",
      "relationType": "relates_to"
    },
    {
      "from": "competition-types",
      "to": "disciplines-and-factors",
      "relationType": "relates_to"
    },
    {
      "from": "scoring-engine",
      "to": "series-unified-model",
      "relationType": "uses"
    },
    {
      "from": "playoffs-knockout-system",
      "to": "best-of-single",
      "relationType": "relates_to"
    },
    {
      "from": "void-match-rendering",
      "to": "playoffs-knockout-system",
      "relationType": "relates_to"
    },
    {
      "from": "data-flow-principle",
      "to": "server-action-pattern",
      "relationType": "relates_to"
    },
    {
      "from": "feature-module-layout",
      "to": "data-flow-principle",
      "relationType": "relates_to"
    },
    {
      "from": "color-semantics",
      "to": "component-canon",
      "relationType": "relates_to"
    },
    {
      "from": "row-action-pattern",
      "to": "component-canon",
      "relationType": "relates_to"
    },
    {
      "from": "treffsicher-disciplines",
      "to": "result-recording-validation",
      "relationType": "relates_to"
    },
    {
      "from": "shot-routines",
      "to": "training-sessions",
      "relationType": "relates_to"
    },
    {
      "from": "deploy-flow",
      "to": "build-deploy-pipeline",
      "relationType": "relates_to"
    },
    {
      "from": "build-deploy-pipeline",
      "to": "monorepo-fast-build",
      "relationType": "relates_to"
    },
    {
      "from": "target-architecture",
      "to": "network-segmentation",
      "relationType": "relates_to"
    },
    {
      "from": "target-architecture",
      "to": "caddy-reverse-proxy",
      "relationType": "relates_to"
    },
    {
      "from": "target-architecture",
      "to": "db-isolation-model",
      "relationType": "relates_to"
    },
    {
      "from": "repo-architecture-map",
      "to": "monorepo-migration-phases",
      "relationType": "relates_to"
    },
    {
      "from": "pre-deploy-backup",
      "to": "deploy-flow",
      "relationType": "relates_to"
    },
    {
      "from": "failed-migration-recovery",
      "to": "manual-migration-intervention",
      "relationType": "relates_to"
    },
    {
      "from": "restore-from-backup",
      "to": "image-tag-rollback",
      "relationType": "relates_to"
    },
    {
      "from": "off-site-backup-gap",
      "to": "nightly-backup-cron",
      "relationType": "relates_to"
    },
    {
      "from": "build-deploy-pipeline",
      "to": "ADR-005",
      "relationType": "governed_by"
    },
    {
      "from": "build-deploy-pipeline",
      "to": "ADR-006",
      "relationType": "informed_by"
    },
    {
      "from": "vps-bootstrap-and-setup",
      "to": "ADR-012",
      "relationType": "informed_by"
    },
    {
      "from": "vps-bootstrap-and-setup",
      "to": "ADR-014",
      "relationType": "informed_by"
    },
    {
      "from": "treffsicher-backlog",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-backlog",
      "to": "treffsicher-actionresult-migration",
      "relationType": "relates_to"
    },
    {
      "from": "treffsicher-backlog",
      "to": "treffsicher-pwa-offline",
      "relationType": "relates_to"
    },
    {
      "from": "treffsicher-future-features",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "treffsicher-future-features",
      "to": "treffsicher-pwa-offline",
      "relationType": "relates_to"
    },
    {
      "from": "monorepo-phase-5",
      "to": "vereinsheim",
      "relationType": "applies_to"
    },
    {
      "from": "monorepo-phase-5",
      "to": "monorepo-migration-phases",
      "relationType": "relates_to"
    },
    {
      "from": "monorepo-phase-5",
      "to": "ADR-006",
      "relationType": "relates_to"
    },
    {
      "from": "env-var-alignment-gap",
      "to": "vereinsheim",
      "relationType": "applies_to"
    },
    {
      "from": "env-var-alignment-gap",
      "to": "ringwerk-auth-security",
      "relationType": "relates_to"
    },
    {
      "from": "dependency-pin-alignment",
      "to": "vereinsheim",
      "relationType": "applies_to"
    },
    {
      "from": "dependency-pin-alignment",
      "to": "drift-protection",
      "relationType": "relates_to"
    },
    {
      "from": "future-adrs",
      "to": "vereinsheim",
      "relationType": "relates_to"
    },
    {
      "from": "future-adrs",
      "to": "off-site-backup-gap",
      "relationType": "relates_to"
    },
    {
      "from": "future-adrs",
      "to": "monorepo-phase-5",
      "relationType": "relates_to"
    }
  ]
}
