# Spiegel — Claude Scope-Notiz

Dritte App im Monorepo: Schussrohdaten der Meyton-Anlage (SSMDB2) über eine lokale Brücke, Zuordnung per
Sportpass-Opt-in und Meyton-QR ([`vault/spiegel/spiegel.md`](../../vault/spiegel/spiegel.md)). Seit SP-1.6 a Teil 1
(Oktober 2026) stehen Datenbank, Zugriffe und Messung ([ADR-031](../../vault/decisions/adr-031.md),
[`spiegel-db-schema`](../../vault/spiegel/spiegel-db-schema.md)); seit Teil 2 Anmeldung, Admin und Ratenbegrenzung,
seit N7 (erster Teil) Start, Scheiben, die Seite einer Scheibe und Profil mit echten Daten
([`spiegel-navigation`](../../vault/spiegel/spiegel-navigation.md)). Der Deploy-Vertrag (`compose.yml`, `Caddyfile`,
`db-init/`) folgt in SP-1.9.

## Befehle

| Befehl                                                     | Zweck                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm dev --filter spiegel`                                | Dev-Server auf :3002                                                                                       |
| `pnpm --filter spiegel exec prisma migrate dev --name <x>` | Schema ändern (braucht `.env` mit `DATABASE_URL`)                                                          |
| `pnpm --filter spiegel test`                               | Tests, die Zugriffe gegen die Dev-Datenbank `spiegel`                                                      |
| `pnpm --filter spiegel measure`                            | Messung „sehr aktiv, 5 Jahre“ mit `EXPLAIN ANALYZE`, nicht im Gate                                         |
| `pnpm --filter spiegel seed:own`                           | die echten Scheiben des Users in die Dev-Datenbank, dem Konto aus `SEED_ADMIN_EMAIL` (`--email`, `--demo`) |
| `pnpm --filter spiegel pruefen`                            | Skriptprüfung der Bedienung in Chrome gegen :3002 (`--start`: eigener Build auf :3012, `--alle`, `--nur`)  |
| `pnpm --filter spiegel ingest-load`                        | Lastskript der Ingest-API: ein Abend mit belegten Ständen wie eine Brücke (`--start`, `--docker <name>`)   |

Die Dev-Datenbank legt `dev/db-init` beim ersten Start an, `scripts/bootstrap-dev.sh` zieht sie für bestehende Volumes
nach. Ohne `.env` nehmen Tests und Messung die Dev-Datenbank aus `.env.example` (`test/dev-database.ts`), NextAuth den
Beispiel-Secret (`src/lib/auth-secret.ts`, nur außerhalb von Produktion). Das erste Admin-Konto legt der Server beim Start
an (`src/instrumentation.ts`, aus `SEED_ADMIN_*`); danach `seed:own`. Für Prüfungen im Browser: `seed:own --demo`, dann
mit dem Demo-Konto aus `tools/demo-account.ts` anmelden; danach `seed:own` für das eigene Konto.

## Aufbau

- `src/app/login` ohne Rahmen; `src/app/(app)/*` mit Anmeldepflicht (`requireSession` im Layout, `proxy.ts` davor):
  Start `/`, Scheiben `/cards`, Scheibe `/cards/[id]`, Fortschritt `/progress`, Profil, Platzhalter (Scannen, Offen),
  Admin `/admin/users`.
- Seiten sind Server-Komponenten: Sitzung, Daten (`src/lib/db/reads.ts`), Kontext (`pageContext`: Zone, „jetzt“,
  benannte Zeiträume). Die Hüllen in `src/components/*/…Screen.tsx` sind Client-Komponenten und
  bauen Routen und Rückrufe (Funktionen gehen nicht vom Server zum Client).
- `AppShell`: `AppFrame` mit `next/link`, Bereich aus der Adresse, letzte Adresse je Bereich, Blatt der Hilfe
  (`useHelp`). Darstellung über `ThemeProvider` (Skript vor dem Zeichnen, `localStorage`).

## Regeln

- **Schichten** (`src/lib/db/`): `raw.ts` legt Rohdaten ab, `cards.ts` schreibt Scheiben, Revisionen und Projektion
  (dazu die gewählten Wertungen, auch `FamilyScoring`, und die gewählte Art),
  `reads.ts` liest für die Ansichten. Seiten und Server Actions rufen nur diese Funktionen, nie Prisma direkt auf Schüsse.
- **Übersichten lesen keine Schüsse** (ADR-031, seit SP-1.8): Start, Liste und das Blättern nehmen `ownerCards` (Scheibe
  mit Projektion, Familie, Scheibenbild) und rechnen die Modelle aus `shot-ui` **auf dem Server**. An den Browser gehen
  nur das Modell und die Lagen der gezeigten Scheiben (`marksOfCards`, `src/lib/marks.ts`); die Hülle baut Routen, eine
  Scheibe öffnet ohne Wertung in der Adresse (in ihrer). Die Liste liest ihre Abfrage auf dem Server (`searchOf` in
  `src/lib/search.ts`), ein Filter schreibt die Adresse, und die Seite rechnet neu. Gemessen bei 1.564 Scheiben: Start
  70 ms und 5 KB statt 8 MB an den Browser ([[spiegel-db-schema]]). Nur die Seite einer Scheibe lädt Schüsse
  (`cardWithShots`, immer mit `ownerId`).
- **Fortschritt** (`/progress`): Der Server rechnet `periodModel` über `progressPageData` (`src/lib/overview.ts`, wie
  Start und Liste) und gibt `lightPeriodModel` weiter. Filter gehen über `router.push`; die Wahl (Verlauf, Liste, Rekord)
  bleibt im Browser und schreibt `pick` mit `replaceState`, die Lagen der Ablesung holt `cardMarksAction`
  (`src/lib/marks-actions.ts`) nach. Gerechnet in der Wertung der Familie; ein `scoring` in der Adresse gilt nicht.
- **Privat ist Standard** ([[spiegel-privacy]]): Jeder Lesezugriff filtert nach dem angemeldeten Schützen, auch für
  Admins. Admin verwaltet Konten und sieht keine fremden Schüsse.
- **Anmeldung wie Ringwerk:** `getAuthSession` prüft gegen die Datenbank (aktiv, `sessionVersion`, einmal je Anfrage
  über `cache`), Server Actions geben `ActionResult` zurück (nie werfen). Ablauf von `authorize`, Store und
  Admin-Auswertung der Sperren kommen aus `@vereinsheim/lib/auth/*`, gemeinsam mit Ringwerk und Treffsicher. Neue
  Rolle, neuer Status oder neues Passwort beenden die Sitzungen eines Kontos (das JWT trägt die Rolle).
- **Admin-Daten prüfen selbst:** jede Admin-Seite und jede Admin-Abfrage ruft `requireAdmin`; das Layout allein schützt
  die Daten einer Seite nicht (Next: bei Navigation im Client läuft es nicht erneut).
- **Passwort vom Admin:** `mustChangePassword` (beim Anlegen und Zurücksetzen). `requireSession` leitet jede Seite zur
  Passwortseite, bevor sie Daten lädt; nur die Passwortseite und das Layout der App rufen mit `passwordChange: true`
  (das Layout läuft auch für die Passwortseite und leitete sie sonst auf sich selbst um, Test).
- **Nach der Anmeldung** nur Pfade derselben Herkunft (`safeCallback`, aufgelöst wie im Browser). Abmelden mit `signOut({ redirect: false })` und eigener Navigation: Mit Umleitung
  baut `next-auth/react` die Adresse aus `NEXTAUTH_URL`, ohne sie `localhost:3000` (Ringwerk), am Handy über die
  Netzadresse ins Leere. `proxy.ts` lässt alles unter `_next/` frei (sonst fängt es die Verbindung des Dev-Servers ab).
- **Formulare mit Server Action gesteuert** (`value` + `onChange`): React setzt ungesteuerte Felder nach dem Absenden
  zurück, ein Feldfehler löschte sonst die Eingaben.
- **Skript im `<head>` nur aus dem HTML** (`ThemeScript`): Es rendert nur auf dem Server und beim Hydrieren. Nach einem
  Hydrierungsfehler baut React die ganze Wurzel samt `<head>` im Client neu und warnte sonst „Encountered a script
  tag“. Taucht die Warnung wieder auf, ist sie eine Folgemeldung: den Hydrierungsfehler suchen (12. Oktober 2026).
- **instrumentation:** den Node-Teil nur im Zweig `NEXT_RUNTIME === "nodejs"` laden (`instrumentation-node.ts`); Next
  bündelt die Datei auch für Edge, und dort fehlt `fs` für `pg`.
- **Wertung je Scheibe und je Familie, keine des Geräts** (User, 12. Oktober 2026, `plans/2026-10-12-spiegel-wertung.md`):
  - Die Regel ist eine reine Funktion (`src/lib/scoring.ts`). Die **Scheibe**: gewählt (`Card.scoringChoice`), sonst
    Wettkampf in der amtlichen der Disziplin, Training wie am Stand (`Card.standScoring`, die häufigste Anzeigeart der
    Schüsse wie am Ausdruck, `writeRevision` setzt sie bei jedem Stand), ohne beides Zehntel. Anders als die Projektion
    hat `standScoring` keine Version: Ändert sich die Regel, rechnet erst ein neuer Stand (Brücke, `seed:own`) nach. Die **Familie**: gespeichert
    (`FamilyScoring`), sonst die häufigste ihrer Scheiben, bei Gleichstand Zehntel.
  - Die Zugriffe liefern `OverviewCard.scoring` und `PageCard.scoring`, `familyScorings` die gespeicherten nach Kennung.
    `overview.ts` rechnet jede Familie in ihrer: in der Liste Ø und Abstand, auf Start jeden Block, den Fortschritt.
    Vorn in Liste und Start steht die Wertung der Scheibe.
  - Umschalten speichert über Server Actions (`src/lib/scoring-actions.ts`, nur eigene Scheiben bzw. Familien mit eigenen
    Scheiben, danach `revalidatePath`): auf der Seite einer Scheibe `setCardScoring`, in Liste und Fortschritt
    `setFamilyScoring`. Bedient auf der Seite einer Scheibe und auf Start als weicher Kreis neben der großen Zahl
    (`ScoringToggle` aus `shot-ui`, Plan `plans/2026-10-13-spiegel-symbole.md`), in Liste und Fortschritt als
    Wechsel-Chip in Worten nach dem Chip „Filter“ (`ScoringChip`, Fehler unter den Filtern); jede Hülle führt ihre Wahl
    einmal
    über `useSavedChoice` (`src/components/shell/`), Kopf am Telefon und Box teilen sie: gezeigt sofort, ein Fehler (auch
    ein abgelehnter Aufruf, `saveChoice`) steht als Text im Platz `notice` statt im Error-Boundary. Auf Start trägt jeder
    Block seinen Kreis (`ScoredEveningBlock` in `StartScreen`). Die Seite einer Scheibe öffnet in `route.scoring ?? card.scoring`; die Adresse trägt die Wertung
    nur, solange sie nicht die der Scheibe ist (`addressScoring`).
- **Art der Scheibe wie die Wertung** (User, 12. Oktober 2026, `plans/2026-10-12-spiegel-art.md`): `Card.kind` ist die Art
  der Quelle (jeder Stand schreibt sie, heute `seed:own` mit „training“, später der Adapter), `Card.kindChoice` die Wahl des
  Schützen, die kein Stand anfasst. Es gilt `kindChoice ?? kind` (`kindOfRow` in `reads.ts`), in Übersicht, Seite und
  Vorgabe der Wertung. Umstellen auf der Seite einer Scheibe (`KindToggle`, Pokal im weichen Kreis vor dem der Wertung,
  `setCardKind` in `src/lib/card-kind-actions.ts`); eine Scheibe nur aus Probe ist Training und hat keinen Kreis der Art. Ändert die Art die
  Vorgabe der Wertung, folgt die Seite (`seenScoring` in `CardScreen`). `Status` der SSMDB2 ist an der Vereinsanlage leer
  ([[meyton-ssmdb2]]); ein Vorschlag aus der `Rangliste` kommt mit dem Adapter ([[spiegel-roadmap]]). Sitzung und
  Kennung prüfen die Actions über `src/lib/action-guards.ts`.
- **Darstellung der Scheibe gemerkt** (User, 12. Oktober 2026): Ebenen, „übrige blass/aus“ und Ausschnitt (ganze
  Scheibe oder Gruppe) als Cookie
  `spiegel-target` (`src/lib/target-display*.ts`, Format aus `@vereinsheim/shot-ui/target/display`). Die Seite einer
  Scheibe liest ihn auf dem Server, damit das erste Bild stimmt; jede Änderung schreibt ihn neu, das Öffnen nie (nach
  Zurück bringt Next die alte Darstellung aus dem Cache; die Seite übernimmt dann die gemerkte). Auch der Ausschnitt
  bleibt beim Wechsel der Scheibe; ohne Schüsse zeigt „Gruppe“ die ganze Scheibe (`groupView`).
- **Projektion nur aus dem Fachkern.** `cardProjection` und `cardMarks` rechnen, die App speichert. Steigt eine
  Kennzahl-`version` oder `PROJECTION_VERSION`, holt `refreshProjections` die veralteten nach (auch die einer früheren
  Revision), je Scheibe unter der Sperre ihrer Zeile; beim Start des Servers `refreshStaleProjections` im Hintergrund.
- **Revisionen sind Korrekturen der Wertung** (SF-67, `shotChange`): Eine neue entsteht nur, wenn sich eine
  Wertungszeile ändert oder wegfällt. Neue Schüsse und die Probe, die Meyton beim ersten Wertungsschuss löscht (SF-03)
  oder neu beginnt (SF-72), ändern die aktuelle Revision; die Scheibe ist so, wie am Ausdruck. Merkmale der Scheibe
  (Zustand, vollständig, Merkmale) stehen in ihrer Zeile, die amtliche Wertung an der Disziplin (SF-74).
- **Reihenfolge und Kennung:** `storeSnapshot` und `writeRevision` nehmen dasselbe Advisory-Lock (Quelle, ScheibenID).
  Ein Stand mit nicht größerer Folgenummer als `RawSnapshot.lastSequence` bzw. `Card.lastSequence` ändert nichts
  (SF-26), einer mehr als zehn Minuten in der Zukunft wird abgelehnt. Dieselbe ScheibenID Wochen später ohne gemeinsamen
  Schuss ist ein `CardIdentityConflictError`: der nächste Zyklus (`cycle`, SF-77). Die Kennung einer Scheibe ändert ein
  Stand nie, außer eine Scheibe aus dem PDF bekommt ihre Rohdaten.
- **Familie mitgeführt:** `Card.familyId` kopiert die Familie der Disziplin für den Index; umhängen nur über
  `setDisciplineFamily` (eine Transaktion mit den Scheiben).
- **Tests gegen die Dev-Datenbank:** je Datei eine eigene Anlage (`test/fixtures.ts`, `createTestSite`), am Ende
  gelöscht (Scheiben der Disziplinen, Kaskade über die Anlage, dazu Schütze und Familie); Dateien laufen nacheinander
  (`fileParallelism: false`). Testscheiben aus `test/generate.ts` (fester Seed, Werte aus der Lage über den Fachkern,
  Probe beim ersten Wertungsschuss gelöscht, `liveStates` für den offenen Durchgang), echte Snapshot-Folgen aus
  `@vereinsheim/ssmdb2-cases/frozen` (als Empfangszeit die Beobachtungszeit: die Fälle sind teils auf Tage nach heute
  datiert). `refreshProjections` in Tests nur mit `sourceId`.
- **Prisma 7 wie Ringwerk:** Client in `src/generated/prisma` (gitignored), `@prisma/adapter-pg`, keine URL im Schema.
  Nach einer Schemaänderung `prisma generate`, sonst meldet der Client unbekannte Felder.
- **Bis zum ersten Deploy (SP-1.9) genau eine Migration** (User, 10. Oktober 2026): `prisma/migrations/*_init`. Eine
  Schemaänderung ersetzt sie, statt eine zweite anzulegen: `prisma migrate diff --from-empty --to-schema
prisma/schema.prisma --script` (ohne die Zeilen `CREATE SCHEMA`) nach `…_init/migration.sql`, gegengeprüft in einem
  Wegwerf-Postgres (`migrate diff --from-config-datasource` gegen das Schema leer). Die Dev-Datenbank zieht der User
  nach (`pnpm --filter spiegel exec prisma migrate reset --force`); ein Agent setzt sie nicht zurück, Prisma und der
  Auto-Modus verlangen dafür den User. Ab dem ersten Deploy nur noch neue Migrationen.
- **Speicher** im Container messen, nicht auf dem Mac (macOS zählt anders; 765 MB auf dem Mac waren 227 MiB im
  Container): Standalone-Build in `node:24-alpine` mit `--memory=256m`, anmelden, Seiten abrufen, `docker stats`
  (10. Oktober 2026, nach dem Review: 57 MiB nach dem Start, 147 bis 152 MiB unter Last). Dafür einen eigenen
  `NEXTAUTH_SECRET` setzen: Produktion verweigert den Beispielwert aus `.env.example`.
- **seed:own** nur gegen die lokale Dev-Datenbank `spiegel` (prüft die Adresse, `--force` für eine andere lokale).
- Ausgabe in Werkzeugen über `process.stdout.write`, nicht `console.log` (Lint).
- **Skriptprüfung der App** (`tools/pruefen.ts`, `tools/pruefen/browser.ts`; Plan `plans/2026-10-13-aufraeumen-labor.md`,
  ersetzt seit 13. Oktober 2026 die des Labors): Chrome headless über das DevTools-Protokoll mit dem `WebSocket` von Node,
  ohne Abhängigkeit; Klicks, Ziehen und Tasten sind echte Eingaben (`Input.dispatch*`), Fokus und `next/link` verhalten
  sich wie beim Menschen. Angemeldet mit dem Demo-Konto (vorher `seed:own --demo`). Geprüft wird ohne feste Zahlen
  (echte Daten): Sprungleiste, Kleben, Rücksprung mit Pille, „Alle Beobachtungen“, Blatt der Hilfe, Lineal mit Zeiger
  und Tastatur, Platz der Scheibe bei mehreren Fenstergrößen, kein seitliches Scrollen am Telefon, Anker beim Laden,
  Blättern, Rückwege, Rekorde, Blatt „Filter“, Fachbegriffe auf den ersten Ebenen, ein „?“ je Thema des Fortschritts,
  keine Skriptfehler. Nicht im Gate (braucht Chrome, Server, Daten). Nach Änderungen an Bedienung oder Bausteinen:
  `pnpm build` (oder `pnpm check`), dann `pruefen --start`, damit die Prüfung den eigenen Stand sieht und nicht einen
  Dev-Server aus einem anderen Checkout. Neue Bedienung bekommt eine Prüfung dort. Eine Taste, die die Seite nicht nimmt,
  meldet `window.__keys` (Lauscher ganz außen; Alt+Pfeil wird dort abgefangen, sonst ginge der Browser zurück).
- **Ingest-API** (SP-1.6 b, `plans/2026-10-13-spiegel-ingest.md`, [[spiegel-ingest-pipeline]]): Route Handler unter
  `src/app/api/ingest/v1/` reichen nur an `src/lib/ingest/http.ts` durch (Handler nehmen `Request`, geben `Response`,
  testbar ohne Next). Dort erst die Grenzen (Token, Ratenbegrenzung, höchstens zwei Stapel, Bytegrenze, Vertrag), dann
  `ingestBatch` (`ingest.ts`: Epoche, Zustimmung, Sperren, verdeckt, Ablage, Adapter je Scheibe nur für den neuesten
  Stand). Kopplung, Token, Heartbeat und Zustand in `bridges.ts`, der Adapter in `meyton-ssmdb2.ts` (reine Funktion,
  Tests an allen Fällen von `ssmdb2-cases`).
  - **Nichts ohne Zustimmung speichern:** Was nicht zu einer bestätigten SportpassID der Anlage passt, verwirft das
    Einlesen, bevor `storeSnapshot` läuft. Eine neue Regel dort braucht einen Test, der zeigt, dass nichts abgelegt wird.
  - **Logs nur mit Zahlen und festen Codes** (`Log` in `http.ts`), unerwartete Fehler nur mit ihrem Namen: Die Meldungen
    von Prisma enthalten Werte. Der Test in `http.test.ts` schickt einen Namen durch jede Fehlerart.
  - **Lebenszeichen** (`LIFESIGN` in `raw.ts`): ein Stand, der sich nur in `Scheiben.Zeitstempel` unterscheidet, wird
    am letzten vermerkt, ohne Zeile und ohne Adapter ([[adr-031]], Änderung vom 13. Oktober 2026).
  - **Zustände** schaltet der Heartbeat weiter (`advanceCardStates`), `complete` gilt erst endgültig. `writeRevision` hält
    `korrigiert` und `uhr-abweichung` dauerhaft; eine andere Anzeigeart ist keine Korrektur (`sameScoring`, SF-74).
  - **Admin → Anlage und Brücken** (`/admin/site`): Anlage, Brücken koppeln (Code nur in der Antwort der Action) und
    widerrufen, Epochen bestätigen; SportpassIDs am Konto (`/admin/users/[id]`), das Profil zeigt die eigenen.
  - Tests gegen die Dev-Datenbank: `createTestSite` legt die Epoche bestätigt an; der Admin arbeitet auf der ersten
    Anlage (ADR-029: eine je Installation).
- **Blättern hängt die Seite neu ein** (`key={card.id}`) und liest den Anker nur auf der eigenen Adresse (`useHash`): Next
  rendert die nächste Scheibe, solange die Adresse noch die der vorigen ist, und ihr `#position` war sonst der Reiter der
  nächsten (gefunden von der Skriptprüfung, 13. Oktober 2026).
