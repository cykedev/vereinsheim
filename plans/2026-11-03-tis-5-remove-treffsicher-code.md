# 5: Der Code von Treffsicher geht aus dem Repo

Teilplan des Koordinationsplans [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md), Stufe 5.
Branch `feat/tis-5-remove-treffsicher-code` vom Basisbranch `feat/treffsicher-in-spiegel` (`60f003c2`). Den Schritt hat
der User am 3. November 2026 angestoßen („dann kann doch der Großteil des Codes von Treffsicher weg“).

**Geschützte Pfade:** `scripts/` und `.claude/` gehören zu den geschützten Pfaden (ADR-023). Alle Aufgaben mit
**[geschützt]** laufen ohne Autopilot-Marker. Die koordinierende Session prüft ihren Diff bei der Übernahme.
`compose.yml`, `compose.local.yml`, `Caddyfile`, `db-init/` und `tools/stack-e2e/` bleiben unverändert. Schema und
Migrationen von Ringwerk und Spiegel bleiben unverändert. Eine neue Brücke braucht es nicht.

## Kontext

Seit Stufe 4 läuft Treffsicher nicht mehr. Unter seinem Host zeigt Caddy eine Hinweisseite. Die Daten sind in Spiegel:
Sechs Konten sind umgezogen, die drei übrigen haben keine Daten. Der Code in `apps/treffsicher` (392 Dateien) wird nur
noch vom Gate geprüft und von `dev-setup` eingerichtet. Sonst braucht ihn nichts mehr:

- Backup, Restore und Restore-Probe arbeiten mit `pg_dump` und `pg_restore` und zählen Tabellen und Migrationen in der
  Datenbank. Sie lesen nichts aus `apps/treffsicher`.
- Die Übernahme (`vereinsheim transfer`, `pnpm --filter spiegel transfer`) liest die Datenbank von Treffsicher mit
  `psql` (`apps/spiegel/tools/transfer/*.sql`, `source-dev.ts`). Sie braucht weder die App noch ihren Prisma-Client.
- Spiegel und Ringwerk importieren nichts aus `apps/treffsicher`. Ringwerk nennt Treffsicher nur in Kommentaren.

## Ansatz

- **Weg:** `apps/treffsicher` als Ganzes, sein Eintrag im Lockfile, sein Dev-Server in `.claude/launch.json`, der Skill
  `seed` (nur Treffsicher hatte einen Seed) und alle Stellen in Harness, Skripten und Doku, die ihn als laufenden Code
  nennen.
- **`CODE_APPS=(ringwerk spiegel)`** in `scripts/lib/apps.sh`. Damit prüft das Drift-Gate zwei Apps und `dev-setup`
  richtet zwei ein. `APPS`, `DATA_APPS` und `UPLOAD_APPS` bleiben, wie sie sind.
- **Bleibt bis zum Löschtermin am 1. Februar 2027:** die Datenbank `treffsicher` (Prod und Dev), ihr Owner, das Volume
  `uploads_treffsicher`, `DATA_APPS` mit Treffsicher, `TREFFSICHER_DB_PASSWORD`, `db-init` und die Werkzeuge der
  Übernahme (`vereinsheim transfer`, `apps/spiegel/tools/transfer`, `src/parts/transfer`, `src/diary/transfer`,
  `src/lib/transfer`). So lässt sich ein Konto bis dahin noch einmal übernehmen oder korrigieren. Was am Löschtermin geht,
  steht schon in [[operations]] („Löschtermin am 1. Februar 2027“). Diesen Abschnitt ergänzt der Plan um die Werkzeuge
  der Übernahme.
- **Bleibt ganz:** die Hinweisseite, der Vermerk „Aus Treffsicher übernommen“ und die Herkunft `treffsicher` an den
  Daten in Spiegel, die Notes unter `vault/apps/treffsicher/` als Archiv (Fachwissen zu Tagebuch, Zielen, Abläufen und
  Befinden, das Spiegel weiter nutzt), die ADRs und das Textbuch `textbuch-ringwerk-treffsicher.md`.
- **Ringwerk bleibt unberührt:** Seine Kommentare nennen Treffsicher als Geschichte. Keine Datei unter `apps/ringwerk`
  ändert sich. Der Lockfile verliert nur den Importer `apps/treffsicher`. Der Auszug von `turbo prune ringwerk` bleibt
  damit gleich.
- **Akzent von Treffsicher in den Tokens:** Die Blöcke `[data-app="treffsicher"]` und `.dark[data-app="treffsicher"]` in
  `packages/ui/design2.css` fallen weg. Die Hinweisseite hat ihr eigenes CSS und braucht sie nicht. Tests, die
  Treffsicher nur als Beispiel nennen, nehmen Ringwerk.
- **Nicht in diesem Plan (Stufe 5b, eigener Plan, wenn gewünscht):** `@vereinsheim/shot-ui` hat Varianten für
  Treffsicher, etwa „Einheit“ statt „Scheibe“ (`PeriodWordsProvider`), Seiten ohne Lage je Schuss und Links auf eine
  Einheit. Sie bleiben zunächst als Parameter mit der Vorgabe von Spiegel. Sie herauszunehmen ändert Bausteine, die
  Spiegel zeigt, und gehört deshalb in einen eigenen Plan mit Prüfung im Browser.

## Dateien

| Datei | Änderung |
|---|---|
| `apps/treffsicher/**` | entfernt (`git rm -r`) |
| `pnpm-lock.yaml` | Importer `apps/treffsicher` und Pakete, die nur er nutzte, fallen weg |
| `scripts/lib/apps.sh` **[geschützt]** | `CODE_APPS=(ringwerk spiegel)`, Kommentar |
| `scripts/consistency-check.sh` **[geschützt]** | Kopfkommentar: zwei Apps |
| `scripts/bootstrap-dev.sh` **[geschützt]** | Hinweis am Ende ohne Treffsicher :3001 |
| `scripts/vereinsheim` **[geschützt]** | Kommentar über den Listen (Zeile um 167) |
| `.claude/launch.json` **[geschützt]** | Konfiguration `treffsicher` entfernt |
| `.claude/hooks/posttool-lint.mjs` **[geschützt]** | Muster ohne `treffsicher` |
| `.claude/skills/seed/` **[geschützt]** | entfernt |
| `.claude/skills/{check,test,commit-msg,consolidate-lessons,migrate,db-reset,review,sync-graph}/SKILL.md` **[geschützt]** | Treffsicher als App entfernt |
| `.claude/agents/code-reviewer.md` **[geschützt]** | zwei Apps |
| `apps/spiegel/tools/transfer/report.ts` | Hinweis `pnpm --filter treffsicher moved --clear` ersetzt |
| `packages/ui/design2.css`, `packages/ui/src/design2/tokens.test.ts` | Akzent von Treffsicher entfernt |
| `packages/ui/src/design2/app-frame.test.tsx`, `packages/ui/src/design2/theme/ThemeScript.test.tsx` | Beispiel Ringwerk statt Treffsicher |
| `packages/ui/src/design2/help.tsx`, `packages/lib/src/auth/{client-ip,credentials}.ts`, `packages/meyton-pdf/CLAUDE.md` | Kommentare und Doku: zwei Apps |
| `CLAUDE.md`, `README.md`, `apps/spiegel/CLAUDE.md`, `packages/ui/CLAUDE.md` | Treffsicher nicht mehr als Code im Repo |
| `vault/architecture/architecture.md`, `vault/overview.md`, `vault/conventions.md`, `vault/monorepo/monorepo.md`, `vault/operations/operations.md`, `vault/operations/drift-protection.md`, `vault/apps/treffsicher/treffsicher.md` | Stand nach dem Entfernen |

## Required Docs

- [[adr-033]] mit den Nachträgen zu Stufe 4, [[adr-023]] (geschützte Pfade), [[adr-029]] (keine Personendaten)
- `vault/conventions.md` §1 und §8 (Drift-Gate, Lockfile nach `pnpm install`)
- `vault/operations/operations.md`, Abschnitte „Treffsicher im Ruhestand“ und „Löschtermin am 1. Februar 2027“
- `scripts/lib/apps.sh`, `scripts/consistency-check.sh`, `scripts/bootstrap-dev.sh`
- [[spiegel-account-transfer]] (Werkzeuge der Übernahme, die bleiben)
- `apps/spiegel/CLAUDE.md`, `packages/ui/CLAUDE.md`

## Aufgaben

Jede Aufgabe ein Commit, danach `pnpm check`. Vor dem ersten Gate im Worktree die Verknüpfungen auf `apps/*/.env` und
`apps/spiegel/tools/private` aus dem Hauptcheckout anlegen, jede mit `[ -e … ] ||` davor (nicht auf sich selbst).
`apps/treffsicher/.env` braucht keine Verknüpfung mehr.

1. **[geschützt] Die Liste des Codes.** In `scripts/lib/apps.sh` `CODE_APPS=(ringwerk spiegel)` setzen und den
   Kommentar darüber so fassen: Der Code im Repo, für Gate und `dev-setup`. Treffsicher hat seit Stufe 5 keinen Code mehr,
   nur noch Datenbank und Anhänge bis zum Löschtermin. Kopfkommentar in `scripts/consistency-check.sh` (Zeilen 2 und 12)
   auf zwei Apps. In `scripts/bootstrap-dev.sh` die Zeile mit `pnpm dev` am Ende auf `ringwerk :3000, spiegel :3002`. Das
   `ALTER ROLE treffsicher CREATEDB` bleibt, die Rolle gibt es in Dev bis zum Löschtermin. Den Kommentar um Zeile 167 in
   `scripts/vereinsheim` nachziehen. `bash -n` auf alle vier Dateien.
2. **`apps/treffsicher` entfernen.** `git rm -r -q apps/treffsicher`, danach `rm -rf apps/treffsicher` im Worktree
   (ignorierte Reste wie `.next`, `node_modules`, die Verknüpfung auf `.env`). Dann `pnpm install`. Den Diff von
   `pnpm-lock.yaml` prüfen: Er darf nur Zeilen entfernen (`git diff pnpm-lock.yaml | grep -E '^\+[^+]'` ist leer). Fügt
   pnpm Zeilen ein, nur die Entfernungen übernehmen (alter Lockfile ohne den Importer, gegenprüfen mit
   `pnpm install --frozen-lockfile`). `turbo run build --dry=json` darf kein Paket `treffsicher` mehr nennen.
3. **[geschützt] Harness.** In `.claude/launch.json` die Konfiguration `treffsicher` entfernen. In
   `.claude/hooks/posttool-lint.mjs` das Muster auf `apps\/(?:ringwerk|spiegel)`. `.claude/skills/seed/` entfernen. In
   den Skills `check`, `test`, `commit-msg`, `consolidate-lessons`, `migrate`, `review` und `sync-graph` Treffsicher als
   App herausnehmen. In `db-reset` fällt die Zeile `pnpm --filter treffsicher exec prisma db push` weg, und der Skill
   setzt die Datenbank `treffsicher` nicht mehr zurück: Sie ist eine Kopie aus Prod, die die Übernahme in Dev bis zum
   Löschtermin liest. In `.claude/agents/code-reviewer.md` zwei Apps (Ringwerk und Spiegel) und Drift zwischen ihnen.
4. **Hinweis im Bericht der Übernahme.** In `apps/spiegel/tools/transfer/report.ts` (Fall `markedNotSaved`) den Hinweis
   `pnpm --filter treffsicher moved --clear <E-Mail in Treffsicher>` ersetzen durch
   `./scripts/vereinsheim transfer mark --local --from <E-Mail in Treffsicher> --clear`. Vorher in `transfer_usage` und
   `cmd_transfer` (`scripts/vereinsheim`) prüfen, dass `mark` mit `--local` und `--clear` angenommen wird. Wenn nicht,
   denselben SQL-Hinweis wie im anderen Zweig nehmen, mit `NULL`:
   `in Treffsicher: UPDATE "User" SET "movedToSpiegelAt" = NULL WHERE email = '<E-Mail in Treffsicher>';`. Gibt es einen
   Test, der den Text festhält, ihn mitziehen.
5. **Tokens und geteilte Pakete.** In `packages/ui/design2.css` die Blöcke `[data-app="treffsicher"]` und
   `.dark[data-app="treffsicher"]` entfernen. In `tokens.test.ts` `APPS = ["ringwerk"] as const`. In `app-frame.test.tsx`
   `brand: "Ringwerk"` und die Erwartung `>Ringwerk</p>`, in `ThemeScript.test.tsx` `storageKey: "ringwerk-theme"`. Die
   Kommentare in `packages/ui/src/design2/help.tsx` und `packages/lib/src/auth/{client-ip,credentials}.ts` auf Ringwerk
   und Spiegel. In `packages/meyton-pdf/CLAUDE.md` die Sätze über Treffsicher streichen (`unpdf` steht in fester Version
   in Spiegel, die Frage nach Treffsicher entfällt). Die Varianten für Treffsicher in `@vereinsheim/shot-ui` bleiben
   (Stufe 5b).
6. **Doku.**
   - Root-`CLAUDE.md`: Treffsicher hat keinen Code mehr im Repo, die Liste der Apps ohne `apps/treffsicher`, der Skill
     `seed` fällt aus der Liste.
   - `README.md`, `apps/spiegel/CLAUDE.md` und `packages/ui/CLAUDE.md`: Treffsicher nicht mehr als App.
   - `vault/architecture/architecture.md`: Repo-Karte ohne `apps/treffsicher`, Routen ohne Treffsicher, „alle drei Apps“
     wird zu Ringwerk und Spiegel.
   - `vault/overview.md`, `vault/monorepo/monorepo.md`, `vault/operations/drift-protection.md`: zwei Apps.
   - `vault/conventions.md`: §1 (byte-gleich in Ringwerk und Spiegel), die Stellen zu Treffsicher in §2, §4 und §10 (eigene
     Dateien wie `DiscardChangesDialog`, `src/lib/help/topics.ts`, `src/lib/missing.ts`, `consequences.ts`, Akzent Teal).
     Die Lehren in §9 bleiben, ihre Beispiele mit Pfaden in `apps/treffsicher` bekommen „(Code entfernt)“ oder ein
     Beispiel aus Ringwerk oder Spiegel.
   - `vault/operations/operations.md`: Der Schritt mit `pnpm --filter treffsicher exec prisma db push` (um Zeile 681)
     fällt weg oder nennt, dass Treffsicher keinen Code mehr hat. Im Abschnitt „Löschtermin am 1. Februar 2027“ kommen die
     Werkzeuge der Übernahme dazu: `vereinsheim transfer`, `apps/spiegel/tools/transfer`, `src/parts/transfer`,
     `src/diary/transfer`, `src/lib/transfer`, `TREFFSICHER_DB_PASSWORD`, Treffsicher in `DATA_APPS` und `UPLOAD_APPS`,
     die Dev-Datenbank in `dev/db-init`.
   - `vault/apps/treffsicher/treffsicher.md`: TL;DR und Status sagen, dass der Code seit Stufe 5 nicht mehr im Repo ist.
     Den letzten Stand findet man über den Tag `treffsicher-final`. Die Notes darunter sind Archiv.
   - Am Ende `git grep -n -i 'filter treffsicher\|apps/treffsicher'` außerhalb von `vault/apps/treffsicher`,
     `vault/decisions` und `plans/`: Jeder Treffer ist Geschichte oder wird nachgezogen.
   - `node .claude/vault-lint.mjs` ist grün. Vault-Notes nicht mit Prettier formatieren.

## Test steps

1. `bash -n scripts/lib/apps.sh scripts/consistency-check.sh scripts/bootstrap-dev.sh scripts/vereinsheim`
2. `./scripts/consistency-check.sh` ist grün und nennt `ringwerk spiegel`.
3. `pnpm install --frozen-lockfile` läuft ohne Änderung durch, `git diff --stat pnpm-lock.yaml` nur mit Entfernungen.
4. `pnpm check` ist grün, Ringwerk und Spiegel kommen dabei vor, Treffsicher nicht.
5. `pnpm --filter @vereinsheim/ui test` (Tokens, Rahmen, Darstellung) und `pnpm --filter spiegel test -- tools/transfer`
   sind grün.
6. `node .claude/vault-lint.mjs` ist grün.

## Verification

- `git ls-files apps/treffsicher` ist leer, `pnpm -r ls --depth -1` nennt kein `treffsicher`.
- `git diff --stat feat/treffsicher-in-spiegel -- apps/ringwerk compose.yml compose.local.yml Caddyfile db-init tools/stack-e2e`
  ist leer.
- `git grep -n 'CODE_APPS'` zeigt nur Nutzer, die zwei Apps erwarten (Gate, `bootstrap-dev`).
- `./scripts/vereinsheim help` läuft, `transfer` steht weiter darin.
- Kein Release nötig: Spiegel ändert sich nur in den Tokens (eine tote Regel weniger) und im Werkzeug der Übernahme, das
  nicht im Image liegt. Es geht mit dem nächsten Release von Spiegel mit.

## Bei der Übernahme (koordinierende Session)

- Vor dem Fast-forward den Tag `treffsicher-final` auf den letzten Commit des Basisbranchs mit dem Code setzen
  (`git tag -a treffsicher-final -m "Last commit with the Treffsicher app code" <sha>`). Pushen macht der User.
- Nach dem Fast-forward liegen im Hauptcheckout unter `apps/treffsicher/` noch ignorierte Dateien (`.env`, `.next`,
  `node_modules`). Die koordinierende Session entfernt den Ordner erst nach dem OK des Users.
- Nachtrag in ADR-033 (Stufe 5) und Zeile im Koordinationsplan.
