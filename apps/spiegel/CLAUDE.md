# Spiegel — Claude Scope-Notiz

Dritte App im Monorepo: Schussrohdaten der Meyton-Anlage (SSMDB2) über eine lokale Brücke, Zuordnung per
Sportpass-Opt-in und Meyton-QR ([`vault/spiegel/spiegel.md`](../../vault/spiegel/spiegel.md)). Datenbank, Zugriffe
und Messung: [ADR-031](../../vault/decisions/adr-031.md), [`spiegel-db-schema`](../../vault/spiegel/spiegel-db-schema.md);
Seiten und Navigation: [`spiegel-navigation`](../../vault/spiegel/spiegel-navigation.md). Spiegel ist deployt:
`migrate-spiegel` (192 MB) und `app-spiegel` (256 MB, Heap 160, Volume `uploads_spiegel` für Ausdrucke) in `compose.yml`, eine Subdomain mit höchstens 5 MiB
je Anfrage im `Caddyfile`, die Datenbank aus `db-init/` bzw. `scripts/db-ensure.sh`; Betrieb in
[`vault/operations/operations.md`](../../vault/operations/operations.md). Lokal prüft `tools/stack-e2e/run.sh` den
Stack Ende zu Ende.

## Befehle

| Befehl                                                     | Zweck                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev --filter spiegel`                                | Dev-Server auf :3002                                                                                                                                                        |
| `pnpm --filter spiegel exec prisma migrate dev --name <x>` | Schema ändern (braucht `.env` mit `DATABASE_URL`)                                                                                                                           |
| `pnpm --filter spiegel test`                               | Tests, die Zugriffe gegen die Dev-Datenbank `spiegel`                                                                                                                       |
| `pnpm --filter spiegel measure`                            | Messung „sehr aktiv, 5 Jahre“ mit `EXPLAIN ANALYZE`, nicht im Gate                                                                                                          |
| `pnpm --filter spiegel seed:own`                           | eigene Scheiben aus `tools/private/own-cards.json` (gitignored) in die Dev-Datenbank, ohne sie erfundene; dem Konto aus `SEED_ADMIN_EMAIL` (`--email`, `--demo`)            |
| `pnpm --filter spiegel pruefen`                            | Skriptprüfung der Bedienung in Chrome gegen :3002 (`--start`: eigener Build auf :3012, `--alle`, `--nur`)                                                                   |
| `pnpm --filter spiegel ingest-load`                        | Lastskript der Ingest-API: ein Abend mit belegten Ständen wie eine Brücke (`--start`, `--docker <name>`)                                                                    |
| `pnpm --filter spiegel stack-probe`                        | Grenzen hinter Caddy gegen einen laufenden Stack (`BASE_URL`, `DATABASE_URL`; aus `tools/stack-e2e/run.sh`)                                                                 |
| `pnpm --filter spiegel bridge-e2e`                         | die echte Brücke (Go) Ende zu Ende gegen den eigenen Build auf :3012 mit MariaDB, drei Fällen und Aufträgen per ID (`--keep`), mit `BASE_URL` gegen einen laufenden Spiegel |
| `pnpm --filter spiegel exec tsx tools/printout-sample.ts`  | erfundener Meyton-Ausdruck (ID `ff914420`) als PDF nach stdout, für den Stack-Test und zum Messen des Lesers (`--kind memory\|time`: präparierte Bomben)                    |

Die Dev-Datenbank legt `dev/db-init` beim ersten Start an, `scripts/bootstrap-dev.sh` zieht sie für bestehende Volumes
nach. Ohne `.env` nehmen Tests und Messung die Dev-Datenbank aus `.env.example` (`test/dev-database.ts`), NextAuth den
Beispiel-Secret (`src/lib/auth-secret.ts`, nur außerhalb von Produktion). Das erste Admin-Konto legt der Server beim Start
an (`src/instrumentation.ts`, aus `SEED_ADMIN_*`); danach `seed:own`. Für Prüfungen im Browser: `seed:own --demo`, dann
mit dem Demo-Konto aus `tools/demo-account.ts` anmelden; danach `seed:own` für das eigene Konto.

## Aufbau

- `src/app/login` ohne Rahmen; `src/app/(app)/*` mit Anmeldepflicht (`requireSession` im Layout, `proxy.ts` davor):
  Start `/`, Scheiben `/cards`, Scheibe `/cards/[id]`, Fortschritt `/progress`, Vergleichen `/compare` (Bereich
  Fortschritt, nicht in der Leiste), Profil, Papierkorb `/profile/trash`,
  Offen `/open`, Platzhalter Scannen `/scan` (nicht in der Navigation, `scan={false}` im `AppShell`),
  Admin `/admin` (Übersicht), `/admin/users{/[id],/new}`, `/admin/disciplines{/[id]}`, `/admin/lists{/[id]}`,
  `/admin/site`; die Bereiche stehen einmal in `src/lib/admin/sections.ts` (Reiter `AdminTabs` auf jeder Admin-Seite,
  am Telefon oben in Profil). `src/app/share/[shareId]` ohne Anmeldung und ohne
  `AppShell` (`SharedShell`: Kopfzeile als Text, Blatt der Hilfe): eine geteilte Scheibe.
- Seiten sind Server-Komponenten: Sitzung, Daten (`src/lib/db/reads.ts`), Kontext (`pageContext`: Zone, „jetzt“,
  benannte Zeiträume). Die Hüllen in `src/components/*/…Screen.tsx` sind Client-Komponenten und
  bauen Routen und Rückrufe (Funktionen gehen nicht vom Server zum Client).
- `AppShell`: `AppFrame` mit `next/link`, Bereich aus der Adresse, letzte Adresse je Bereich, Blatt der Hilfe
  (`useHelp`). Darstellung über `ThemeProvider` aus `@vereinsheim/ui/design2/theme` (Skript vor dem Zeichnen, `localStorage` unter
  `spiegel-theme`).

## Regeln

- **Schichten** (`src/lib/db/`): `raw.ts` legt Rohdaten ab, `cards.ts` schreibt Scheiben, Revisionen und Projektion
  (dazu die gewählten Wertungen, auch `FamilyScoring`, und die gewählte Art),
  `reads.ts` liest für die Ansichten. Seiten und Server Actions rufen nur diese Funktionen, nie Prisma direkt auf Schüsse.
- **Übersichten lesen keine Schüsse** (ADR-031): Start, Liste und das Blättern nehmen `ownerCards` (Scheibe
  mit Projektion, Familie, Scheibenbild) und rechnen die Modelle aus `shot-ui` **auf dem Server**. An den Browser gehen
  nur das Modell und die Lagen der gezeigten Scheiben (`marksOfCards`, `src/lib/marks.ts`); die Hülle baut Routen, eine
  Scheibe öffnet ohne Wertung in der Adresse (in ihrer). Die Liste liest ihre Abfrage auf dem Server (`searchOf` in
  `src/lib/search.ts`), ein Filter schreibt die Adresse, und die Seite rechnet neu. Gemessen bei 1.564 Scheiben: Start
  70 ms und 5 KB statt 8 MB an den Browser ([[spiegel-db-schema]]). Nur die Seite einer Scheibe lädt Schüsse
  (`cardWithShots`, immer mit `ownerId`; die geteilte über `sharedCard`, nur mit ihrem Link).
- **Fortschritt** (`/progress`): Der Server rechnet `periodModel` über `progressPageData` (`src/lib/overview.ts`, wie
  Start und Liste) und gibt `lightPeriodModel` weiter. Filter gehen über `router.push`; die Wahl (Verlauf, Liste, Rekord)
  bleibt im Browser und schreibt `pick` mit `replaceState`, die Lagen der Ablesung holt `cardMarksAction`
  (`src/lib/marks-actions.ts`) nach. Das Trefferbild (`show=target`) und die Reiter Präzision und Lage holt
  `periodPatternAction` (`src/lib/pattern-actions.ts`, über `usePeriodPattern`) erst bei Bedarf: Lagen der Projektion
  (`patternCardsOf`), gerechnet auf dem Server; an den Browser gehen bis 3.000 Schuss die Treffer mit Band (nur eigene
  Scheiben), ab 50 Schuss das Raster für die Umrisse (darüber nur noch das Raster), dazu Schwerpunkte und Urteile. Ob das Bild
  Dichte oder Umrisse zeigt, merkt sich das Gerät (`usePatternView`, `localStorage`). Gerechnet in der Wertung der Familie; ein `scoring` in
  der Adresse gilt nicht. Einen Vergleich bietet der Fortschritt nicht mehr an (`withCompare={false}`): „Genauer
  vergleichen“ hinter dem Satz führt auf die Seite Vergleichen, eine Adresse mit `compare=` leitet dorthin um.
- **Vergleichen** (`/compare`, [[spiegel-vergleichen]]): Der Server rechnet `comparePageData` (`src/lib/compare.ts`):
  Zeiträume und Wettkampf/Training aus den Projektionen der Familie und den Lagen (`patternCardsOf`, höchstens 5.000
  Scheiben), zwei Scheiben aus ihren Schüssen (`cardWithShots`, nur eigene, gleiche Familie). An den Browser gehen das
  Modell aus `shot-ui/compare` und die Scheiben der Familie fürs Blatt, nie Schüsse. Jede Wahl ist eine neue Adresse
  (`router.push`). Die Seite einer Scheibe bietet „Mit der Scheibe davor vergleichen“ (`CompareWithPrevious`).
- **Privat ist Standard** ([[spiegel-privacy]]): Jeder Lesezugriff filtert nach dem angemeldeten Schützen, auch für
  Admins. Admin verwaltet Konten und sieht keine fremden Schüsse. Einzige Ausnahme: eine Scheibe, die ihr Schütze per
  Link geteilt hat (`sharedCard`, siehe „Teilen per Link“).
- **Anmeldung wie Ringwerk:** `getAuthSession` prüft gegen die Datenbank (aktiv, `sessionVersion`, einmal je Anfrage
  über `cache`), Server Actions geben `ActionResult` zurück (nie werfen). Ablauf von `authorize`, Store und
  Admin-Auswertung der Sperren kommen aus `@vereinsheim/lib/auth/*`, gemeinsam mit Ringwerk und Treffsicher. Neue
  Rolle, neuer Status oder neues Passwort beenden die Sitzungen eines Kontos (das JWT trägt die Rolle).
- **Kein Knopf ohne Folge** ([[conventions]] §10): Jede Aktion mit
  Folgen fragt über `DecisionDialog` (`@vereinsheim/ui/design2/decision-dialog`); die Texte nur aus `src/lib/admin/consequences.ts`
  (Tests halten den Wortlaut, ohne Pronomen für Personen), die Erklärungen hinter „?“ aus `src/lib/admin/help.ts`
  (`AdminHelp`). Ein Formular mit Folgen (Konto, Zeitzone) fängt `onSubmit` ab, fragt und sendet nach dem Bestätigen
  mit `requestSubmit`. Der Admin beginnt mit der Übersicht (`/admin`, `src/lib/admin/overview.ts`): Aufgaben nur für
  Entscheidungen eines Menschen, Meldungen der Brücke nur als Zustand. **Wortlaut nach dem Textbuch**
  ([[conventions]] §10 „So schreiben wir“): Sportpassnummer statt SportpassID,
  zurückweisen und wieder zulassen statt Meldung, verbinden und trennen; `OLD_WORDS` in `consequences.ts` ist die
  Leitplanke der Tests. Neue Texte erst ins Textbuch, dann in den Code.
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
  tag“. Taucht die Warnung wieder auf, ist sie eine Folgemeldung: den Hydrierungsfehler suchen.
- **instrumentation:** den Node-Teil nur im Zweig `NEXT_RUNTIME === "nodejs"` laden (`instrumentation-node.ts`); Next
  bündelt die Datei auch für Edge, und dort fehlt `fs` für `pg`.
- **Wertung je Scheibe und je Familie, keine des Geräts:**
  - Die Regel ist eine reine Funktion (`src/lib/scoring.ts`). Die **Scheibe**: gewählt (`Card.scoringChoice`), sonst
    die Wertung der Disziplin (Admin → Disziplinen, Vorgabe für Training und Wettkampf, `officialScoring`), sonst wie am
    Stand (`Card.standScoring`, die häufigste Anzeigeart der Schüsse wie am Ausdruck, `writeRevision` setzt sie bei jedem
    Stand), ohne alles Zehntel. Eine Scheibe nur aus Probe hat keine Wertung der Disziplin. Anders als die Projektion
    hat `standScoring` keine Version: Ändert sich die Regel, rechnet erst ein neuer Stand (Brücke, `seed:own`) nach. Die **Familie**: gespeichert
    (`FamilyScoring`), sonst die häufigste ihrer Scheiben, bei Gleichstand Zehntel.
  - Die Zugriffe liefern `OverviewCard.scoring` und `PageCard.scoring`, `familyScorings` die gespeicherten nach Kennung.
    `overview.ts` rechnet jede Familie in ihrer: in der Liste Ø und Abstand, auf Start jeden Block, den Fortschritt.
    Vorn in Liste und Start steht die Wertung der Scheibe.
  - Umschalten speichert über Server Actions (`src/lib/scoring-actions.ts`, nur eigene Scheiben bzw. Familien mit eigenen
    Scheiben, danach `revalidatePath`): auf der Seite einer Scheibe `setCardScoring`, in Liste und Fortschritt
    `setFamilyScoring`. Bedient auf der Seite einer Scheibe und auf Start als weicher Kreis neben der großen Zahl
    (`ScoringToggle` aus `shot-ui`), in Liste und Fortschritt als
    Wechsel-Chip in Worten nach dem Chip „Filter“ (`ScoringChip`, Fehler unter den Filtern); jede Hülle führt ihre Wahl
    einmal über `useSavedChoice` (`src/components/shell/`), Kopf am Telefon und Box teilen sie: gezeigt sofort, ein Fehler (auch
    ein abgelehnter Aufruf, `saveChoice`) steht als Text im Platz `notice` statt im Error-Boundary. Auf Start trägt jeder
    Block seinen Kreis (`ScoredEveningBlock` in `StartScreen`). Die Seite einer Scheibe öffnet in `route.scoring ?? card.scoring`; die Adresse trägt die Wertung
    nur, solange sie nicht die der Scheibe ist (`addressScoring`).
- **Art der Scheibe wie die Wertung:** `Card.kind` ist die Art
  der Quelle (jeder Stand schreibt sie: der Adapter aus `Status`, `seed:own` „training“), `Card.kindChoice` die Wahl des
  Schützen, die kein Stand anfasst. Es gilt `kindChoice ?? ranking.kind ?? kind` (`kindOfRow` in `reads.ts`, der einzige
  Weg zur Art), in Übersicht und Seite. `Ranking` ist die `Rangliste` der SSMDB2 je Anlage: Das
  Einlesen legt sie ohne Art an (`rankingFor`), der Admin ordnet sie zu (`setRankingKind`, Admin → Listen); die
  Zuordnung gilt beim Lesen, keine Scheibe wird umgeschrieben. In der Oberfläche heißt sie „Liste“
  (`OLD_WORDS` hält „Rangliste“ fern): Die Zugriffe liefern sie als `list` (`OverviewCard`, `PageCard`), die Seite einer
  Scheibe nennt sie im Kopf, Scheiben filtern nach ihr (`list=<id>`). Bei einer Scheibe nur aus Probe zählt die Liste nicht
  (Training, nicht umstellbar). Umstellen auf der Seite einer Scheibe (`KindToggle`, Pokal im weichen Kreis vor dem der Wertung,
  `setCardKind` in `src/lib/card-kind-actions.ts`); eine Scheibe nur aus Probe ist Training und hat keinen Kreis der Art. Die Art ändert die
  Wertung nicht; `ScoringToggle` nennt die Wertung der Disziplin nur im Wettkampf „amtlich“. Ändert der Admin die
  Wertung der Disziplin, folgt die Seite (`seenScoring` in `CardScreen`). `Status` der SSMDB2 ist an der Vereinsanlage leer
  ([[meyton-ssmdb2]]). Sitzung und
  Kennung prüfen die Actions über `src/lib/action-guards.ts`.
- **Disziplin je Scheibe:** `Card.disciplineId` ist die Disziplin, mit der alles rechnet (Familie, Scheibenbild,
  Schusszahl, Admin). Hat der Schütze eine andere gewählt, steht die vom Stand in `Card.standDisciplineId`; null heißt
  keine Wahl. `writeRevision` lässt eine Wahl stehen, solange der Stand die Disziplin bringt, gegen die gewählt wurde,
  und rechnet die Merkmale mit `recomputeDisciplineCard` in derselben Transaktion nach; bringt er eine andere (auch die
  gewählte), gilt wieder seine. Gewählt wird nur über `chooseCardDiscipline` (`src/lib/card-discipline-actions.ts`,
  Regeln in `choiceWhere`): eingeordnete Disziplinen der Anlage mit Familie und demselben Scheibenbild wie die vom
  Stand, nicht ignoriert, dazu die vom Stand (zurück, solange sie nicht ignoriert ist). `disciplineOptions` (reads)
  liefert sie mit der Wertung, in der die Scheibe dann zählt. Bedient im Kasten „Diese Scheibe“ am Ende der Seite einer
  Scheibe (`CardActions` mit `CardDiscipline`, Blatt mit Knöpfen, Rückfrage `cardDiscipline`); die geteilte Seite verrät
  die Wahl nicht. Neue Blöcke derselben ScheibenID erben die Wahl nicht (wie Art und Wertung). Ein anderes Scheibenbild
  mit Neu-Wertung (SF-16) ist offen.
- **Darstellung der Scheibe gemerkt:** Ebenen, „übrige blass/aus“ und Ausschnitt (ganze
  Scheibe oder Gruppe) als Cookie
  `spiegel-target` (`src/lib/target-display*.ts`, Format aus `@vereinsheim/shot-ui/target/display`). Die Seite einer
  Scheibe liest ihn auf dem Server, damit das erste Bild stimmt; jede Änderung schreibt ihn neu, das Öffnen nie (nach
  Zurück bringt Next die alte Darstellung aus dem Cache; die Seite übernimmt dann die gemerkte). Auch der Ausschnitt
  bleibt beim Wechsel der Scheibe; ohne Schüsse zeigt „Gruppe“ die ganze Scheibe (`groupView`).
- **Zeitraum des Fortschritts gemerkt:** Cookie
  `spiegel-period` in der Form von `range` (`src/lib/period-memory*.ts`). Geschrieben nur, wenn der Zeitraum im Blatt
  „Filter“ übernommen wird (`setFilters` in `ProgressScreen`, auch `setChoice`, das heute niemand schickt); gelesen auf dem Server, wenn `/progress`
  keine eigene Abfrage hat außer `family` und `metric` (die Familie hängt die Navigation an, die Kennzahl der Weg von σ
  auf der Seite einer Scheibe, `sigmaRoute`). Ein benannter Zeitraum, den es nicht mehr gibt,
  gilt als keiner.
- **Projektion nur aus dem Fachkern.** `cardProjection` und `cardMarks` rechnen, die App speichert. Steigt eine
  Kennzahl-`version` oder `PROJECTION_VERSION`, holt `refreshProjections` die veralteten nach (auch die einer früheren
  Revision), je Scheibe unter der Sperre ihrer Zeile; beim Start des Servers `refreshStaleProjections` im Hintergrund.
- **Revisionen sind Korrekturen der Wertung** (SF-67, `shotChange`): Eine neue entsteht nur, wenn sich eine
  Wertungszeile ändert oder wegfällt; neue Schüsse ändern die aktuelle Revision. Merkmale der Scheibe (Zustand,
  vollständig, Merkmale) stehen in ihrer Zeile, die amtliche Wertung an der Disziplin (SF-74).
- **Jeder Block eine Scheibe** ([[adr-027]], Änderung vom 17. Oktober 2026): Löscht Meyton die Probe (erster
  Wertungsschuss SF-03, Neustart SF-72), beginnt der nächste Stand eine neue Scheibe derselben ScheibenID (`Card.block`,
  eindeutig mit Quelle, ScheibenID und Zyklus). Die Grenze ist eine reine Funktion (`startsNewBlock`, `blockEnds` in
  `src/lib/ingest/probe-blocks.ts`): Die bisherige Scheibe ist reine Probe, und der neue Stand teilt keinen Schuss
  (Fingerabdruck) mit ihr. Eine Scheibe mit Wertung teilt sich nie. `rereadOutdatedKeys` (`src/lib/ingest/reread.ts`)
  liest beim Start und stündlich jede ruhende ScheibenID neu, deren Stände eine ältere `adapterVersion` tragen, und legt
  fehlende Blöcke an (Besitzer, Warten und Papierkorb von der vorhandenen Scheibe).
- **Reihenfolge und Kennung:** `storeSnapshot` und `writeRevision` nehmen dasselbe Advisory-Lock (Quelle, ScheibenID).
  Ein Stand mit nicht größerer Folgenummer als `RawSnapshot.lastSequence` bzw. `Card.lastSequence` ändert nichts
  (SF-26), einer mehr als zehn Minuten in der Zukunft wird abgelehnt (`future`), eine Beobachtung mehr als 15 Minuten
  vor der Empfangszeit ebenso (`past`, `MAX_OBSERVED_LAG_MS`, SF-79: die Uhr der Brücke geht nach). Tests mit
  eingefrorenen Fällen geben deshalb `nowMs` = Beobachtung und schicken Fälle verschiedener Tage nicht in einem Stapel.
  Aus einem Heartbeat mit `sentAt` mehr als 60 s neben der Empfangszeit legt `recordHeartbeat` keine Uhrmessung an
  (`HEARTBEAT_CLOCK_MAX_MS`). Dieselbe ScheibenID Wochen später ohne gemeinsamen Schuss ist ein
  `CardIdentityConflictError`: der nächste Zyklus (`cycle`, SF-77). Die Kennung einer Scheibe ändert ein Stand nie,
  außer eine Scheibe aus dem PDF bekommt ihre Rohdaten.
- **Familie mitgeführt:** `Card.familyId` kopiert die Familie der Disziplin für den Index; umhängen nur über
  `moveDisciplineFamily` (in der Transaktion des Aufrufers, mit den Scheiben) bzw. `setDisciplineFamily`.
- **Disziplinen einordnen** (Admin → Disziplinen, [[spiegel-target-library]]): Das Einlesen legt jede neue Disziplin
  selbst an (`disciplineFor` in `src/lib/db/disciplines.ts`, auch für `seed:own`): mit der Zuordnung einer eingeordneten
  Disziplin derselben Nummer (in Meyton umbenannt), sonst mit dem Vorschlag des Fachkerns, ignoriert bei Meytons Spielen
  und Trainingsscheiben (`suggestIgnore`). Eingeordnet erst mit `confirmedAt`. Felder: Scheibe (`targetId`, null = eigene
  Scheibe), Familie (auch eigene, Kennung aus dem Namen und fest, `familySlug`), Wertung
  (`officialScoring`, Vorgabe für Training und Wettkampf), Schusszahl (`plannedShots`: null aus der ID, 0 keine feste, `plannedShotsOf`), Ignorieren
  (`ignoredAt`). Ändern sich Scheibe oder Schusszahl, steigt `Discipline.version`; `refreshStaleDisciplineCards` rechnet
  Scheiben mit anderer `Card.disciplineVersion` aus den Schüssen der aktuellen Revision nach (nach dem Speichern über
  `after()`, beim Start, stündlich). Gegenprobe und Merkmale der Disziplin rechnen Adapter und Nachrechnen mit denselben
  Funktionen (`src/lib/ingest/card-checks.ts`: `baseShotFlags`, `verifyShots`, `mappingFlags`); `verdaechtig` ist keine
  Korrektur (`sameScoring`). Ignorierte Disziplinen filtert `VISIBLE_CARD` (`SHOWN_DISCIPLINE`), `PENDING_CARD` nicht
  (die Bestätigung der ersten Scheibe gibt alle frei); „Offen“ und Papierkorb filtern zusätzlich. Was der Admin je Konto
  und in der Nutzung zählt, nimmt `COUNTED_CARD` ohne Bedingung an die Disziplin: Sonst verriete das Umschalten, wer eine
  Disziplin geschossen hat. Die Seite zeigt je Disziplin nur Zahlen der ganzen Anlage (letzte Scheibe als Monat, Anzeige
  am Stand und Schusszahl erst ab drei Schützen; der Server lässt sie darunter weg, `disciplines.ts`), nie je Konto.
  Scheibenbilder nur über `Object.hasOwn(TARGETS, …)` prüfen (`in` nimmt auch geerbte Schlüssel). Das Nachrechnen nimmt
  dieselbe Sperre wie `writeRevision` (Quelle, ScheibenID). Eigene Scheiben, deren Disziplin wartet, nennt Start
  (`waitingForDiscipline`).
- **Tests gegen die Dev-Datenbank:** je Datei eine eigene Anlage (`test/fixtures.ts`, `createTestSite`), am Ende
  gelöscht (Scheiben der Disziplinen, Kaskade über die Anlage, dazu Schütze und Familie); Dateien laufen nacheinander
  (`fileParallelism: false`). Testscheiben aus `test/generate.ts` (fester Seed, Werte aus der Lage über den Fachkern,
  Probe beim ersten Wertungsschuss gelöscht, `liveStates` für den offenen Durchgang), echte Snapshot-Folgen aus
  `@vereinsheim/ssmdb2-cases/frozen` (als Empfangszeit die Beobachtungszeit: die Fälle sind teils auf Tage nach heute
  datiert). `refreshProjections` in Tests nur mit `sourceId`.
- **Prisma 7 wie Ringwerk:** Client in `src/generated/prisma` (gitignored), `@prisma/adapter-pg`, keine URL im Schema.
  Nach einer Schemaänderung `prisma generate`, sonst meldet der Client unbekannte Felder.
- **Migrationen nur anhängen:** Spiegel ist deployt. Eine Schemaänderung bekommt eine neue Migration
  (`pnpm --filter spiegel exec prisma migrate dev --name <x>`); `…_init` und jede andere angewandte Migration bleiben
  unverändert. Die Dev-Datenbank setzt der User zurück (`pnpm --filter spiegel exec prisma migrate reset --force`);
  ein Agent setzt sie nicht zurück, Prisma und der Auto-Modus verlangen dafür den User.
- **Speicher** im Container messen, nicht auf dem Mac (macOS zählt anders; 765 MB auf dem Mac waren 227 MiB im
  Container): Standalone-Build in `node:26-alpine` mit `--memory=256m`, anmelden, Seiten abrufen, `docker stats`
  (Richtwerte: 57 MiB nach dem Start, 147 bis 152 MiB unter Last). Dafür einen eigenen
  `NEXTAUTH_SECRET` setzen: Produktion verweigert den Beispielwert aus `.env.example`. Mit dem echten Image und den
  Grenzen aus `compose.yml`: `tools/stack-e2e/run.sh --load <min>` (Richtwerte: Spitze 147 MiB, unter Last 108
  bis 112 MiB).
- **seed:own** nur gegen die lokale Dev-Datenbank `spiegel` (prüft die Adresse, `--force` für eine andere lokale).
- Ausgabe in Werkzeugen über `process.stdout.write`, nicht `console.log` (Lint). Werkzeuge und Quellen der App laufen
  unter tsx als CommonJS (`package.json` ohne `"type"`): kein `await` auf oberster Ebene, sondern `main().catch(…)`.
- **Skriptprüfung der App** (`tools/pruefen.ts` mit `@vereinsheim/pruefen`): Chrome headless über das DevTools-Protokoll mit dem `WebSocket` von Node,
  ohne Abhängigkeit; Klicks, Ziehen und Tasten sind echte Eingaben (`Input.dispatch*`), Fokus und `next/link` verhalten
  sich wie beim Menschen. Angemeldet mit dem Demo-Konto (vorher `seed:own --demo`). Geprüft wird ohne feste Zahlen
  (echte Daten): Sprungleiste, Kleben, Rücksprung mit Pille, „Alle Beobachtungen“, Blatt der Hilfe, Lineal mit Zeiger
  und Tastatur, Platz der Scheibe bei mehreren Fenstergrößen, kein seitliches Scrollen am Telefon, Anker beim Laden,
  Blättern, Rückwege, Rekorde, Blatt „Filter“, Fachbegriffe auf den ersten Ebenen, ein „?“ je Thema des Fortschritts,
  keine Skriptfehler. Nicht im Gate (braucht Chrome, Server, Daten). Nach Änderungen an Bedienung oder Bausteinen:
  `pnpm build` (oder `pnpm check`), dann `pruefen --start`, damit die Prüfung den eigenen Stand sieht und nicht einen
  Dev-Server aus einem anderen Checkout. Neue Bedienung bekommt eine Prüfung dort. Eine Taste, die die Seite nicht nimmt,
  meldet `window.__keys` (Lauscher ganz außen; Alt+Pfeil wird dort abgefangen, sonst ginge der Browser zurück).
- **Ingest-API** ([[spiegel-ingest-pipeline]]): Route Handler unter
  `src/app/api/ingest/v1/` reichen nur an `src/lib/ingest/http.ts` durch (Handler nehmen `Request`, geben `Response`,
  testbar ohne Next). Dort erst die Grenzen (Token, Ratenbegrenzung, höchstens zwei Stapel, Bytegrenze, Vertrag), dann
  `ingestBatch` (`ingest.ts`: Epoche, Zustimmung, Sperren, verdeckt, Ablage, Adapter für jeden neuen Stand in Folge,
  geschrieben je Block der letzte; jeder Stand trägt danach `adapterVersion` und `block`). Kopplung, Token, Heartbeat und Zustand in `bridges.ts`, der Adapter in `meyton-ssmdb2.ts` (reine Funktion,
  Tests an allen Fällen von `ssmdb2-cases`).
  - **Nichts ohne Zustimmung speichern:** Was nicht zu einer aktiven SportpassID der Anlage passt (bestätigt, nicht
    abgelehnt) oder zu einem offenen Auftrag per ID mit passendem Abend, verwirft das Einlesen, bevor `storeSnapshot`
    läuft. Eine neue Regel dort braucht einen Test, der zeigt,
    dass nichts abgelegt wird.
  - **Logs nur mit Zahlen und festen Codes** (`Log` in `http.ts`), unerwartete Fehler nur mit ihrem Namen: Die Meldungen
    von Prisma enthalten Werte. Der Test in `http.test.ts` schickt einen Namen durch jede Fehlerart.
  - **Lebenszeichen** (`LIFESIGN` in `raw.ts`): ein Stand, der sich nur in `Scheiben.Zeitstempel` unterscheidet, wird
    am letzten vermerkt, ohne Zeile und ohne Adapter ([[adr-031]], Änderung vom 13. Oktober 2026).
  - **Zustände** schaltet der Heartbeat weiter (`advanceCardStates`), `complete` gilt erst endgültig. `writeRevision` hält
    `korrigiert` und `uhr-abweichung` dauerhaft; eine andere Anzeigeart ist keine Korrektur (`sameScoring`, SF-74).
  - **Admin → Anlage und Brücke** (`/admin/site`): Anlage, Brücken verbinden (Code nur in der Antwort der Action) und
    trennen, getrennte entfernen (`removeBridge`: nur getrennte, Rohdaten und Codes bleiben mit `bridgeId` null). Die Listen (`Ranking`)
    ordnet der Admin unter Admin → Listen zu (`/admin/lists`, Blatt je Liste wie bei Disziplinen, `src/lib/admin/rankings.ts`). Eine neue Epoche bestätigt niemand in der Oberfläche; die Übersicht
    zeigt nur einen Hinweis. Zustimmungen per Sportpass bestätigt oder lehnt der Admin am Konto ab
    (`/admin/users/[id]`, offene als Aufgabe in der Übersicht und als Link in „Konten“); eintragen kann nur der Schütze
    im Profil.
  - Tests gegen die Dev-Datenbank: `createTestSite` legt die Epoche bestätigt an; der Admin arbeitet auf der ersten
    Anlage (ADR-029: eine je Installation).
- **Was der Admin je Konto sieht:** Zahl der sichtbaren Scheiben, Tag
  der letzten, Wartende in „Offen“ und den Hinweis „noch keine Scheibe seit der Bestätigung“ (aktive Zustimmung älter als
  14 Tage ohne jede Scheibe, auch ohne gelöschte und zurückgewiesene), gezählt in `getUsers` über `groupBy`; in der Übersicht eine Zeile zur Nutzung. Nie
  Ergebnisse, Disziplinen oder Schüsse. Das sagt auch der Hinweistext (v2), dem der Schütze zustimmt.
- **Zustimmung per Sportpass** (`src/lib/consent/`): Zustände als reine
  Funktion `consentStatus` (wartet, aktiv, abgelehnt, zurück beim Admin; Ablehnung geht vor). Jeder Filter auf „aktiv“
  nimmt `ACTIVE_CONSENT` aus `status.ts` (`GET /state`, Einlesen), nie eine eigene Kopie. Der Hinweistext steht
  unveränderlich in `texts.ts` (`CONSENT_TEXTS`, Tests halten die Hashes von v1 und v2 fest; aktuell v2); ein neuer Wortlaut ist eine neue
  Version, die Zeile speichert `consentVersion`. Widerruf löscht die Zeile, die Scheiben bleiben. Entscheidungen
  des Admins tragen ihre Bedingung im `updateMany` selbst (zweimal → „Das hat gerade schon jemand entschieden. Lade die Seite neu.“). Das Formular schickt die
  Version des gezeigten Texts mit; die Grenze zählt und legt an unter der Sperre der Kontozeile. Eine Nummer je Konto:
  Für einen neuen Ausweis widerruft der Schütze die alte, die Scheiben bleiben. Konten, die schon mehrere Nummern haben,
  bleiben, wie sie sind.
- **Erste Scheibe:** Das Einlesen legt eine neue Scheibe als
  wartend an (`Card.ownerPending`), solange ihre Zustimmung kein `firstCardConfirmedAt` hat; spätere Stände ändern das
  nicht. **Jede Abfrage über eigene Scheiben für eine Ansicht nimmt `VISIBLE_CARD`** (`src/lib/db/visible.ts`), sonst
  steht eine wartende, also womöglich fremde Scheibe in Start, Liste oder Fortschritt; „Offen“ liest über `PENDING_CARD`
  (`pendingFirstCards`, `pendingCount` für die Zahl am Start-Symbol im Layout). „Ja, meine“ / „Nicht meine“ in
  `src/lib/first-card-actions.ts`, danach `revalidatePath("/", "layout")`. Entfernt wird nur über `purgeCards`
  (`src/lib/db/purge.ts`: Grabstein, Scheibe, ihre Stände nach dem **Beginn aus den Trefferzeiten**, nie nach der
  Beobachtung, verwaiste Zeilen), die Grundlage auch für Löschen und Papierkorb. Bleibt ein anderer Block derselben
  ScheibenID, gehen nur die Stände dieses Blocks; die Löschsperre entsteht, außer ein späterer Block bleibt. Sperren und Zyklen über
  `src/lib/db/blocks.ts` (`startHintMs`, `isKeyBlocked`, `maxCycleOfKey`); `storeSnapshot` prüft sie unter seiner
  Sperre (`startAtMs`). Beide Actions sperren zuerst die Zeile der Scheibe und gelten je Anlage und SportpassID.
- **Löschen mit Papierkorb:** `purgeCards(tx, ids, block)` hinterlässt einen Grabstein (`{ tombstone: reason }`, mit
  `userId` und `sportpassId` der Scheibe: wer gemeldet hat, unter welcher Nummer) oder die weiche Sperre des Besitzers
  (`{ lock: true }`, `DeleteLock`). Löschen setzt nur `deletedAt` (`src/lib/trash-actions.ts`: `deleteCard`,
  `restoreCard` bis 30 Tage, `purgeCardNow`, je unter `FOR UPDATE` der Zeile); nach 30 Tagen löscht `purgeExpiredTrash`
  (`src/lib/db/trash.ts`) beim Start und stündlich endgültig, je Scheibe unter der Sperre ihrer Zeile neu geprüft. Der
  Knopf steht im Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe (`DeleteCard`), danach der Rückweg mit „Scheibe
  gelöscht · Rückgängig“ (`useUndo` aus `@vereinsheim/ui/design2/undo`, im Rahmen der App, überlebt die Navigation der
  Aktion). Eine alte Adresse einer gelöschten Scheibe führt in den Papierkorb (`ownCardState`). Der Papierkorb zeigt
  auch, was nicht von selbst wiederkommt (`blockedCards`: eigene Sperren und Meldungen „nicht meine“); die
  Admin-Übersicht zählt nur die Meldungen der Anlage, ohne Namen.
- **Scheibe per ID holen** (Profil, `src/lib/card-requests/`): Der Schütze tippt die ID vom Ausdruck (`parseCardId`, acht
  Hex-Zeichen wie im Fuß) und den Tag. `requestCard` legt einen `CardRequest` an, außer die Scheibe des Abends liegt schon
  in Spiegel (eigene: Weg zu ihr, fremde: „vergeben“), höchstens zehn offene je Konto, Frist 30 Tage (`expireRequests`).
  `bridgeState` nennt offene Aufträge aktiver Konten (`requests` mit Abend, dann alle Sperren), `ingestBatch` nimmt einen
  Stand ohne Zustimmung nur mit offenem Auftrag und passendem Abend an (`eveningOfStart` aus `startHintMs`), hängt die
  Scheibe an den Auftrag (`attachRequestCard`) oder schließt ihn (`mismatch`, `taken`, `held`). Offen mit Scheibe bleibt
  er, bis sie endgültig ist (`finishRequests` im Heartbeat, dann `done`); `recordHeartbeat` schließt `missing`, `held`
  und `mismatch` aus `requestsDone` nur ohne Scheibe. Eine Zustimmung per Sportpass geht vor, auch eine wartende eines
  anderen Kontos. Gesperrte Abende nimmt `requestCard` gar nicht an (`blocked`). Nach 30 Tagen `expireRequests`: mit
  Scheibe `done`, ohne `expired`. Abschnitt `CardRequests` im Profil, Texte `cardRequest`, `cardRequestWithdraw`. Ein
  beendeter Auftrag ohne Scheibe lässt sich im Profil entfernen (`isRemovable` in `src/lib/card-requests/status.ts`,
  `removeRequest` löscht die Zeile, Text `cardRequestRemove`).
- **Ausdrucke** (`src/lib/printouts/`, SP-1.7 b, [[meyton-printout]]): Bausteine ohne Oberfläche.
  - `fetchPrintout` holt per Link: nur http(s), keine Weiterleitungen, 1 MiB, 10 s, nur PDF, nach außen nur ein fester
    Grund. Keine Liste erlaubter Adressen ([[adr-028]], Restrisiko SF-47).
  - `readPrintoutIsolated` liest ID und Druckzeit in einem kurzlebigen Kindprozess (SF-48): 48 MB Heap, `--lite-mode`,
    Abbruch über 96 MiB RSS (Linux), harte Zeitgrenze erst nach „bereit“, einer zur Zeit, höchstens drei warten. Umgebung nur
    `NODE_ENV`. **Nie `@vereinsheim/meyton-pdf/printout` im Server importieren**, sonst liegt pdf.js im Prozess der App.
    In Produktion läuft das Bündel `printout-reader.mjs`, gebaut nach `next build` (`tools/build-reader.ts`) direkt in
    `.next/standalone/apps/spiegel`; in Dev und Tests die Quelle über `--import tsx`. Fehlt das Bündel in Produktion,
    meldet der Start es.
  - `storePrintout` prüft, liest und speichert die Datei nach sha256 unter `UPLOAD_DIR/printouts/` (in Produktion
    Pflicht), ohne Datenbank; nur mit ID und Druckzeit (ohne Zeitzone die Wanduhr der Anlage).
  - `attachPrintout(tx, file, cardId)` legt die Zeile in der Transaktion des Aufrufers an: Ein Ausdruck hängt immer an
    einer Scheibe. `printoutFile` liest die Datei nur für den Besitzer, nicht für eine wartende Scheibe.
  - Dateien löscht nur `removeOrphanPrintoutFiles` (beim Start, stündlich nach dem Papierkorb, nach „Nicht meine“ und
    `purgeCardNow`): jede Datei ohne Zeile, älter als zehn Minuten; bei ganz leerer Tabelle keine.
- **Ältere Scheiben nachladen:** Eine aktive Zustimmung ohne
  `historyLoadedAt` ist ein Auftrag mit `since` (`historyRequestedAt`, gesetzt beim Bestätigen und Aufheben; alte Zeilen:
  `confirmedAt`); `bridgeState` nennt sie in `history` und liefert dann alle Sperren, nicht nur die jüngsten 60 Tage.
  Der Heartbeat setzt `historyLoadedAt` nur für `historyDone` mit passendem `since` an aktiven, offenen Zustimmungen der
  Anlage mit aktivem Konto (sonst überschriebe ein altes „erledigt“ ein frisches Aufheben).
  „Offen“ zeigt je Nummer die **jüngste** wartende Scheibe (`pendingGroups`). Ein Admin hebt Meldungen „nicht meine“
  einer Zustimmung auf (`liftNotMine` in `src/lib/consent/actions.ts`, am Konto): Grabsteine der Nummer an der Anlage weg,
  `historyLoadedAt` und `firstCardConfirmedAt` null, die Scheiben kommen wartend wieder. Profil und Übersicht zeigen den
  Stand des Nachladens als Zustand.
- **Teilen per Link** ([[spiegel-navigation]] „Teilen per Link“): `Card.shareId` (UUID aus `randomUUID`, eindeutig) und
  `sharedAt`; `shareCard` (unter `lockCard`) und `stopSharingCard` (ein `updateMany`) in `src/lib/share-actions.ts`,
  ohne `revalidatePath`: Den Stand hält `CardScreen` (sofort aus dem Ergebnis, danach `router.refresh()`, ein anderer
  vom Server gilt) und gibt ihn über `CardActions` an `ShareCard` und `DeleteCard`. `deleteCard` beendet das Teilen. Die
  geteilte Seite liest nur über `sharedCard` (`PAGE_CARD_SELECT` mit `VISIBLE_CARD` und aktivem Konto, nie Angaben zum
  Besitzer) und rendert `CardScreen` mit `own={null}`: ohne Kontextleiste, Art, Wertung, den Kasten „Diese Scheibe“ und
  ohne Fortschreiben der Adresse. `proxy.ts` lässt `share/` frei (`src/proxy.test.ts`); die Kennung prüft `isShareId`,
  bevor eine Abfrage läuft. Skriptprüfung „Geteilte Scheibe“ in einem Fenster ohne Cookies
  (`newPage({ isolated: true })`).
- **Blättern hängt die Seite neu ein** (`key={card.id}`) und liest den Anker nur auf der eigenen Adresse (`useHash`): Next
  rendert die nächste Scheibe, solange die Adresse noch die der vorigen ist, und ihr `#position` war sonst der Reiter der
  nächsten.
