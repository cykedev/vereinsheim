# 3e · Treffsicher lesend je Konto

Teilplan von Stufe 3 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-3e-read-only`, Branch `feat/tis-3e-read-only` von `main` (`39dca9f4`), zurück nach `main`.
Entscheidungen: Designkonzept 3c/3e (vom User am 29. Oktober 2026 mit allen Empfehlungen freigegeben,
https://claude.ai/artifact/84tuTUTfmPcxXVXYQMSnKV) und „Entschieden mit dem User am 29. Oktober 2026 (Planung Stufe 3)“
im Koordinationsplan.

## Kontext

Die Übernahme (3a) nimmt ein Konto auf einmal von Treffsicher nach Spiegel mit. Entsteht danach in Treffsicher noch
etwas, geht es verloren. Deshalb merkt sich Treffsicher je Konto, dass es umgezogen ist, und lässt dieses Konto nur
noch lesen: Hinweis auf jeder Seite mit „Zu Spiegel“, keine Knöpfe zum Ändern, und der Server lehnt jede Änderung an
eigenen Daten ab. Admin bleibt für Admins bedienbar, weil die übrigen Konten noch in Treffsicher arbeiten, bis alle
umgezogen sind. Anmelden geht weiter, eine Weiterleitung für alle kommt erst in Stufe 4.

3e geht nach `main` und braucht ein eigenes Release von Treffsicher **vor dem ersten Umzug**. Treffsicher ist in `main`
und im Basisbranch gleich (geprüft: `git diff main..feat/treffsicher-in-spiegel -- apps/treffsicher` ist leer).

Stand am Code (`main`, 29. Oktober 2026):

- Sechs Dateien mit `"use server"`, alle Fassaden mit direkt deklarierten async-Funktionen: `src/lib/sessions/actions.ts`
  (13), `goals/actions.ts` (9), `shot-routines/actions.ts` (5, Logik in der Datei), `disciplines/actions.ts` (14),
  `admin/actions.ts` (9), `account/actions.ts` (1). Zusammen 51 Exporte, keine Server Action in Seiten.
- Route Handler: `api/auth/[...nextauth]` (GET/POST, Anmeldung), `api/uploads/[...path]` (GET), `sessions/[id]/export/pdf`
  (GET). Uploads laufen nur über die Action `uploadAttachment`.
- `getAuthSession` (`src/lib/auth-helpers.ts`) liest die Kontozeile bei jeder Anfrage (aktiv, `sessionVersion`, Rolle).
- **„Konto löschen“ gibt es in Treffsicher nicht** (nur Deaktivieren durch den Admin). Es gibt also nichts zu sperren.
- `TREFFSICHER_HOST` ist in `.env.example` `training.example.com`, nicht `treffsicher.<domain>`: Die Adresse von
  Spiegel lässt sich nicht aus der eigenen ableiten.

## Ansatz

### Modell (Schema, eine Migration, geschützter Pfad)

```prisma
model User {
  …
  // Konto ist nach Spiegel umgezogen ([[adr-033]], Stufe 3): Treffsicher zeigt es nur noch lesend. Gesetzt und
  // aufgehoben nur von der Übernahme in Spiegels CLI; null heißt nicht umgezogen
  movedToSpiegelAt DateTime?
}
```

- SQL ohne Datenbank als Quelle: `git show main:apps/treffsicher/prisma/schema.prisma > "$TMPDIR/ts-schema-main.prisma"`,
  dann `pnpm --filter treffsicher exec prisma migrate diff --from-schema "$TMPDIR/ts-schema-main.prisma" --to-schema
  prisma/schema.prisma --script` nach `prisma/migrations/20261029160000_user_moved_to_spiegel/migration.sql`. Erwartet,
  sonst nichts:

  ```sql
  -- AlterTable
  ALTER TABLE "User" ADD COLUMN     "movedToSpiegelAt" TIMESTAMP(3);
  ```

  Additiv: eine Spalte mit NULL, kein Index (gelesen wird je Konto über den Primärschlüssel).
- Anwenden auf Dev mit `pnpm --filter treffsicher exec prisma migrate deploy`. Nie `migrate dev`, nie zurücksetzen (die
  Dev-Datenbank ist eine Prod-Kopie). Die Dev-Datenbank von Treffsicher kennt dieselben Migrationen wie `main`; lehnt
  `deploy` trotzdem ab: `prisma db execute --file …/migration.sql` und `prisma migrate resolve --applied
  20261029160000_user_moved_to_spiegel`.
- **Rückweg auf ein älteres Image:** Prisma nennt in jedem `SELECT` und `INSERT` nur die Spalten seines Schemas; das alte
  Image liest die neue Spalte nicht und legt Konten mit NULL an. Aufgabe 1 belegt das mit dem alten Client. Folge: Mit
  dem alten Image sind umgezogene Konten wieder beschreibbar. Siehe „Offene Punkte“ 8.
- Diff und SQL gehen vor dem Commit an die koordinierende Session (Circuit-Breaker, ADR-023, Autopilot-Guard).
- **Vertrag für 3a/3b** (steht danach in der Vault-Note): Die Übernahme setzt am Ende eines Laufs in der Datenbank von
  Treffsicher `UPDATE "User" SET "movedToSpiegelAt" = now() WHERE id = $1`, der Befehl zum Aufheben `… = NULL`. Die App
  selbst schreibt die Spalte nie.

### Werkzeug für Dev und Tests (statt SQL von Hand)

`tools/moved.ts`, Aufruf `pnpm --filter treffsicher moved <E-Mail>` (setzt `now()`), `… moved --clear <E-Mail>`
(setzt NULL). Nur gegen die lokale Datenbank (`testDb()` aus `tools/pruefen-account.ts`, bricht sonst ab), Ausgabe nur
„gesetzt“, „aufgehoben“, „unverändert“ oder „kein Konto mit dieser E-Mail“, ohne Namen. Kern ist
`setMovedByEmail(db, email, on: boolean): Promise<"set" | "cleared" | "unchanged" | "missing">`, den auch die
Skriptprüfung nutzt.

Begründung gegen dokumentiertes SQL: SQL über `docker exec … psql` verschluckt ohne `-i` die Eingabe still (bekannte
Falle), das Werkzeug prüft die lokale Adresse, und die Skriptprüfung braucht dieselbe Funktion ohnehin. 3a ersetzt es
nicht, sondern schreibt im eigenen Lauf über SQL (Vertrag oben); `tools/moved.ts` bleibt ein Dev-Werkzeug.

### Merkmal in der Sitzung

- `getAuthSession` liest `movedToSpiegelAt` mit (im vorhandenen `select`, keine zweite Abfrage) und setzt
  `session.user.movedToSpiegel = user.movedToSpiegelAt !== null`, wie die Rolle aus der Datenbank vor dem JWT.
- `src/types/next-auth.d.ts`: `Session.user.movedToSpiegel: boolean`. Der `session`-Callback in `src/lib/auth.ts` setzt
  `false`; die Wahrheit setzt `getAuthSession`. Andere Leser der Sitzung gibt es nicht (geprüft: `getServerSession` nur
  in `auth-helpers.ts`).

### Eine Prüfung für alle Schreibwege

Neu `src/lib/moved/`:

- `texts.ts`: alle Texte (Tabelle unten), `MOVED_TEXTS` und `MOVED_PAGES`.
- `rules.ts` (rein):
  - `disciplineWritable(user: { moved: boolean; isAdmin: boolean }, discipline: { isSystem: boolean }): boolean` =
    `!user.moved || (user.isAdmin && discipline.isSystem)`. Das eine Prädikat für Server und Seiten (conventions §9).
  - `spiegelUrl(value: string | undefined, production: boolean): string | null`: eine gültige `http:`/`https:`-Adresse
    → ihre `origin`; sonst außerhalb von Produktion `DEV_SPIEGEL_URL = "http://localhost:3002"`, in Produktion `null`
    (dann kein Knopf, nie ein toter Link).
- `guard.ts` (Server):
  - `refuseIfMoved(): Promise<{ error: string } | null>`: `getAuthSession()`; umgezogen → `{ error: MOVED_TEXTS.refusal }`,
    sonst `null`. Ohne Sitzung `null`, dann meldet die Action selbst, dass niemand angemeldet ist.
  - `refuseDisciplineIfMoved(target: { id: string } | { isSystem: boolean })`: nicht umgezogen → `null`; sonst
    `isSystem` aus `target` oder `db.discipline.findUnique({ where: { id }, select: { isSystem: true } })` (fehlt die
    Disziplin: `null`, die Action meldet „nicht gefunden“), dann `disciplineWritable(…) ? null : { error: … }`.

**Aufruf als erste Zeile jeder Fassade**, die eigene Daten ändert, vor dem Durchreichen:

```ts
export async function deleteSession(id: string): Promise<ActionResult> {
  const refused = await refuseIfMoved()
  if (refused) return refused
  return deleteSessionAction(id)
}
```

Ausnahmen in der Form: `createGoalAndRedirect` (gibt `void` zurück) leitet bei Ablehnung mit `redirect("/goals/new")`
auf die Seite „Das geht jetzt in Spiegel.“; `createShotRoutine`, `updateShotRoutine`, `deleteShotRoutine` und
`changeOwnPassword` tragen die Logik in der Fassade selbst und rufen die Prüfung als erste Zeile. Die Fassade ist der
einzige Eingang von außen (nur diese sechs Dateien tragen `"use server"`), deshalb steht die Prüfung dort und nicht in
den internen `*Action`-Funktionen. Der Preis ist eine zweite Leseabfrage der Kontozeile je Änderung; Änderungen sind
selten, das ist hinnehmbar.

`getFavouriteDisciplineIdAction` räumt beim Lesen einen verwaisten Favoriten auf (`db.user.update`). Für ein umgezogenes
Konto unterbleibt das (`if (!session.user.movedToSpiegel)` um das `update`), Rückgabe gleich `null`.

### Alle Schreibwege und ihre Entscheidung

Zahl: **32 Schreibwege** (30 schreibende Server Actions, 1 Aufräumen in einer lesenden Action, 1 Route Handler mit
POST). Dazu 1 Action ohne Schreiben, die trotzdem abgelehnt wird, und 20 rein lesende Actions.

| Datei (`apps/treffsicher/src/…`) | Action / Weg | Schreibt | Entscheidung für ein umgezogenes Konto |
| --- | --- | --- | --- |
| `lib/sessions/actions.ts` | `createSession` | Einheit, Serien, Ziel-Zuordnung | abgelehnt |
| | `updateSession` | Einheit, Serien, Ziel-Zuordnung | abgelehnt |
| | `deleteSession` | Einheit (Kaskade), Dateien der Anhänge | abgelehnt |
| | `toggleFavourite` | Favorit der Einheit | abgelehnt |
| | `uploadAttachment` | Anhang, Datei in `UPLOAD_DIR` | abgelehnt |
| | `deleteAttachment` | Anhang, Datei | abgelehnt |
| | `saveWellbeing`, `saveReflection`, `savePrognosis`, `saveFeedback` | je eine Zeile (upsert) | abgelehnt (4) |
| | `previewMeytonImport` | nichts (liest ein PDF für das Formular) | abgelehnt, gehört zum Anlegen |
| | `getSessionById`, `getSessions` | – | lesen bleibt |
| `lib/goals/actions.ts` | `createGoal`, `createGoalAndRedirect`, `updateGoal`, `updateGoalAssignments`, `deleteGoal` | Ziel, Zuordnungen | abgelehnt (5) |
| | `getGoalsWithAssignments`, `getGoalById`, `getGoalSessionOptions`, `getGoalsForSelection` | – | lesen bleibt |
| `lib/shot-routines/actions.ts` | `createShotRoutine`, `updateShotRoutine`, `deleteShotRoutine` | Ablauf | abgelehnt (3) |
| | `getShotRoutines`, `getShotRoutineById` | – | lesen bleibt |
| `lib/disciplines/actions.ts` | `setFavouriteDiscipline`, `toggleHiddenDiscipline` | Einstellungen des Kontos | abgelehnt (2) |
| | `createDiscipline` | Disziplin | nur Admin und nur Disziplin der Anlage (`isSystem` im Formular); sonst abgelehnt |
| | `updateDiscipline`, `archiveDiscipline`, `setDisciplineArchived`, `deleteDiscipline` | Disziplin, Favoriten anderer | nur Admin an einer Disziplin der Anlage; eigene abgelehnt (4) |
| | `getFavouriteDisciplineId` | räumt verwaisten Favoriten auf | lesen bleibt, Aufräumen unterbleibt |
| | `getDisciplines`, `getDisciplinesForManagement`, `getDisciplineForDetail`, `getDisciplineUsage`, `getHiddenDisciplineIds`, `getDisciplineById` | – | lesen bleibt |
| `lib/admin/actions.ts` | `createUser`, `updateUser`, `setUserActive`, `clearLoginRateLimitBucket` | Konten, Sperren der Anmeldung | bleibt (Admin, prüft `requireAdminSession`), auch für umgezogene Konten |
| | `getAdminUsers`, `getAdminUserById`, `getAdminSystemDisciplines`, `getAdminBlockedLoginRateLimitBuckets`, `getAdminLoginRateLimitInsights` | – | lesen bleibt |
| `lib/account/actions.ts` | `changeOwnPassword` | Passwort, `sessionVersion` | abgelehnt |
| `app/api/auth/[...nextauth]/route.ts` | POST (Anmelden, Abmelden) | Sperren der Anmeldung | bleibt (Entscheidung 7) |
| `app/api/uploads/[...path]/route.ts` | GET | – | lesen bleibt (Anhänge ansehen) |
| `app/(app)/sessions/[id]/export/pdf/route.ts` | GET | – | bleibt (PDF einer Einheit) |
| `lib/startup.ts` | erster Admin, Standarddisziplinen | nicht je Konto | unberührt |

Grenze „eigene Daten“ gegen Admin: Eigene Daten sind alles, was am eigenen Konto hängt (Einheiten mit allem darunter,
Anhänge, Ziele, Abläufe, eigene Disziplinen, Favorit und ausgeblendete Disziplinen, Passwort). Admin ist, was ein Admin
für alle tut: Konten anderer (und des eigenen) im Admin-Bereich, Sperren der Anmeldung, Disziplinen der Anlage
(`isSystem`).

### Seiten

Das Merkmal kommt in Server-Komponenten aus `session.user.movedToSpiegel`; Client-Komponenten bekommen es als Prop
`readOnly` von ihrer Seite. Kein eigener Kontext.

**Hinweis oben auf jeder Seite** (`src/components/app/moved/MovedBanner.tsx`), im Layout `(app)/layout.tsx` als erstes
Kind von `Page`, nur für ein umgezogenes Konto. Zwei Inhalte, ein Aufbau, eine Stelle:

- **Start** (`/dashboard`, dort landet jede Anmeldung): Titel „Dein Tagebuch ist jetzt in Spiegel.“, Satz, Knopf „Zu
  Spiegel“ und leise „Anmelden mit deinem Konto von Spiegel“ (sagt, was ADR-033 für Konten in beiden Apps verlangt).
- **Alle anderen Seiten**, auch Admin: eine Zeile „Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nur noch lesen.“ und
  der Knopf rechts (am Telefon darunter).

Begründung für zwei Inhalte: Die volle Erklärung steht einmal am Eingang; auf jeder Seite schöbe sie am Telefon rund
150 px Inhalt nach unten. Aufbau, Ort, Farbe und Knopf sind überall gleich (siehe „Offene Punkte“ 1).

- `MovedBanner({ full, spiegelUrl }: { full: boolean; spiegelUrl: string | null })` rein, dazu `MovedBannerHost`
  (Client, `usePathname() === AREAS.start.href`). Markup: `<section data-moved-banner="full|short" aria-label="Hinweis"
  className="grid gap-2 rounded-2xl border border-line-strong bg-accent-wash p-4 text-sm">`; Titel `text-[15px]
  font-semibold`, Satz `text-foreground-2`, leise Zeile `text-[13px] text-muted-foreground` (volle Farbe, §3). Knopf
  `<Button asChild size="sm"><a href={spiegelUrl} data-moved-link>Zu Spiegel</a></Button>` (Variante `default`, also
  `bg-primary`: Teal über `data-app="treffsicher"`, keine Palette-Klasse, kein `dark:`). Gleicher Tab, kein
  `target="_blank"`. Ohne Adresse kein Knopf.
- Adresse: `spiegelUrl(process.env.SPIEGEL_URL, process.env.NODE_ENV === "production")` im Layout, als Prop an Hinweis und
  `AppShell` (Client-Komponenten lesen keine Server-Umgebung). Ziel ist die Wurzel von Spiegel, nicht `/diary`
  („Offene Punkte“ 3).

**Rahmen** (`AppShell`, `areas.ts`): neue Prop `moved: { spiegelUrl: string | null } | null`.

- Umgezogen: die Aktion `new` wird `{ key: "new", label: "Zu Spiegel", short: "Spiegel", href: spiegelUrl, Icon:
  ArrowUpRight }`; `renderLink` rendert für `new` dann ein `<a href>` statt `next/link`. Ohne Adresse entfällt die
  Aktion (Leiste mit vier Einträgen).
- `currentArea(pathname: string, moved: boolean): Area | null` (rein, in `areas.ts`): wie `areaOf`, aber umgezogen wird
  `new` zu `sessions` (`/sessions/new` zeigt dann die Seite „Das geht jetzt in Spiegel.“ und gehört zum Tagebuch; die
  Aktion „Zu Spiegel“ ist nie die gezeigte Seite).

**Knöpfe zum Ändern fehlen** (nur für ein umgezogenes Konto):

| Seite / Komponente | Was wegfällt | Was bleibt |
| --- | --- | --- |
| `dashboard/page.tsx`, `sessions/page.tsx` | Aktion im `EmptyState` („Neue Einheit“) | Beschreibung `MOVED_TEXTS.emptyHint` |
| `sessions/[id]/page.tsx` → `SessionDetailHeader` → `SessionDetailHeaderActions` (`readOnly`) | Favorit, Bearbeiten, Löschen | PDF, Zurück |
| `AttachmentSection` (`readOnly`) | Hochladen, × je Anhang | Liste, Öffnen der Datei |
| `WellbeingSection`, `PrognosisSection`, `FeedbackSection`, `ReflectionSection` (`readOnly`) | „… erfassen“, „Bearbeiten“ | Werte, „Noch nicht erfasst.“ |
| `goals/page.tsx` | Kopfaktion „Neues Ziel“, Aktion im `EmptyState` | Liste |
| `goals/[id]/page.tsx` → `GoalCardSection` (`readOnly`) | `GoalActions` (Bearbeiten, Einheiten zuordnen, Löschen) | `DetailActionBar` nur mit Zurück, `GoalSummary` |
| `shot-routines/page.tsx` | Kopfaktion „Neuer Ablauf“, Aktion im `EmptyState` | Liste |
| `shot-routines/[id]/page.tsx` | Bearbeiten, Löschen | Ablauf, Zurück |
| `disciplines/page.tsx` | Kopfaktion für Mitglieder; für Admins heißt sie „Neue System-Disziplin“ | Liste |
| `disciplines/[id]/page.tsx` | Favorit, Ausblenden; Bearbeiten, Archivieren, Löschen nur noch bei `disciplineWritable` | Angaben, Zurück |
| `profile/page.tsx` → `ProfileScreen` (`moved`) | Formular „Passwort ändern“ | Kasten „Passwort ändern“ mit `MOVED_TEXTS.password`, Darstellung, Abmelden, weitere Bereiche |

**Alte Adressen zum Anlegen oder Bearbeiten** zeigen `MovedPage` (`src/components/app/moved/MovedPage.tsx`, Server):
`PageHeader` mit dem bisherigen Titel der Seite, darunter eine Karte „Das geht jetzt in Spiegel.“ mit dem Satz der
Seite; `data-moved-page="<kind>"`. Kein eigener Knopf: Der Hinweis direkt darüber trägt „Zu Spiegel“, so steht auf
jeder Seite genau ein Knopf dorthin („Offene Punkte“ 2). Die Seite prüft das Merkmal vor jedem Laden von Daten.

| Adresse | `kind` | wann |
| --- | --- | --- |
| `/sessions/new` | `sessionNew` | umgezogen |
| `/sessions/[id]/edit` | `sessionEdit` | umgezogen |
| `/goals/new` | `goalNew` | umgezogen (auch das Ziel von `createGoalAndRedirect`) |
| `/shot-routines/new` | `routineNew` | umgezogen |
| `/shot-routines/[id]/edit` | `routineEdit` | umgezogen |
| `/disciplines/new` | `disciplineNew` | umgezogen und kein Admin; ein umgezogener Admin bekommt das Formular mit `systemOnly` |
| `/disciplines/[id]/edit` | `disciplineEdit` | umgezogen und nicht `disciplineWritable` |

`DisciplineForm` bekommt `systemOnly?: boolean`: dann `<input type="hidden" name="isSystem" value="true" />` statt der
Auswahl „Sichtbarkeit“. Der Server prüft unabhängig davon (`refuseDisciplineIfMoved`).

## Neue Texte (gehen erst zum User, dann ins Textbuch Ringwerk und Treffsicher, dann in den Code)

Anrede „du“ wie in allen Texten von Treffsicher (`consequences/diary.ts`), keine anderen Pronomen für Personen, keine
Semikolons, keine drei Punkte. Abschnitt „Treffsicher: Nur noch lesend (3e)“ in
`vault/_attachments/textbuch-ringwerk-treffsicher.md`. `texts.test.ts` hält jeden Satz wörtlich.

| Stelle | Text |
| --- | --- |
| Hinweis Start, Titel | Dein Tagebuch ist jetzt in Spiegel. |
| … Satz | Alle deine Einheiten, Ziele und Abläufe sind dorthin umgezogen. Hier kannst du noch alles nachlesen, aber nichts mehr ändern. |
| … leise | Anmelden mit deinem Konto von Spiegel |
| Hinweis übrige Seiten | Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nur noch lesen. |
| Knopf (Hinweis, Seitenleiste) | Zu Spiegel |
| Aktion in der Mitte, unter dem Symbol | Spiegel |
| Ablehnung des Servers (jede Action) | Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nichts mehr ändern. |
| Seite statt Formular, Karte | Das geht jetzt in Spiegel. |
| … Neue Einheit | Dein Tagebuch ist umgezogen. Neue Einträge legst du in Spiegel unter „Tagebuch“ an. |
| … Einheit bearbeiten | Dein Tagebuch ist umgezogen. Deine Einträge änderst du in Spiegel unter „Tagebuch“. |
| … Neues Ziel | Deine Ziele sind mit umgezogen. Neue Ziele legst du in Spiegel unter „Tagebuch“ an, im Reiter „Ziele“. |
| … Neuer Schuss-Ablauf | Deine Abläufe sind mit umgezogen. Neue legst du in Spiegel unter „Tagebuch“ an, im Reiter „Abläufe“. |
| … Schuss-Ablauf bearbeiten | Deine Abläufe sind mit umgezogen. Du änderst sie in Spiegel unter „Tagebuch“, im Reiter „Abläufe“. |
| … Neue Disziplin | Dein Tagebuch ist mit deinen eigenen Disziplinen umgezogen. Hier legst du keine neue mehr an. |
| … Disziplin bearbeiten | Dein Tagebuch ist mit deinen eigenen Disziplinen umgezogen. Hier änderst du sie nicht mehr. |
| Leere Liste (statt „Starte mit …“) | Neues legst du jetzt in Spiegel an. |
| Profil, Kasten „Passwort ändern“ | Dein Passwort änderst du jetzt in Spiegel, im Profil. In Treffsicher meldest du dich weiter mit deinem bisherigen Passwort an. |
| Disziplinen, Kopfaktion für umgezogene Admins | Neue System-Disziplin |

Die Reiter „Ziele“ und „Abläufe“ und der Bereich „Tagebuch“ sind die Namen in Spiegel (Basisbranch,
`src/diary/components/DiaryTabs.tsx`, geprüft). Die Seitentitel bleiben die heutigen („Neuer Schuss-Ablauf“,
„Schuss-Ablauf bearbeiten“ usw.).

## Skizze (Telefon)

```
Start                              Eine Einheit
┌─────────────────────────────┐    ┌─────────────────────────────┐
│┌───────────────────────────┐│    │┌───────────────────────────┐│
││Dein Tagebuch ist jetzt in ││    ││Dein Tagebuch ist jetzt in ││
││Spiegel.                   ││    ││Spiegel. Hier kannst du nur││
││Alle deine Einheiten, Ziele││    ││noch lesen.  (Zu Spiegel)  ││
││und Abläufe sind dorthin … ││    │└───────────────────────────┘│
││(Zu Spiegel) Anmelden mit  ││    │[Training]        PDF  Zurück│
││deinem Konto von Spiegel   ││    │Di 22.09.2026, 19:30         │
│└───────────────────────────┘│    │…                            │
│Start                        │    │Befinden                     │
│Willkommen, …                │    │Schlaf ▬▬▬▬▬▬▬     80        │
│…                            │    │(kein „Bearbeiten“)          │
├─────────────────────────────┤    ├─────────────────────────────┤
│Start Tagebuch (↗) Statistik Profil│ Start Tagebuch (↗) …        │
└─────────────────────────────┘    └─────────────────────────────┘
```

## Dateien

Neu (unter `apps/treffsicher/`): `prisma/migrations/20261029160000_user_moved_to_spiegel/migration.sql`,
`src/lib/moved/texts.ts` (+ `texts.test.ts`), `src/lib/moved/rules.ts` (+ `rules.test.ts`), `src/lib/moved/guard.ts`
(+ `guard.test.ts`), `src/lib/moved/coverage.test.ts`, `src/components/app/moved/MovedBanner.tsx`,
`src/components/app/moved/MovedPage.tsx`, `src/components/app/moved/read-only.test.tsx`,
`src/components/app/shell/areas.test.ts`, `tools/moved.ts`, `tools/pruefen-moved.ts`.

Geändert (unter `apps/treffsicher/`): `prisma/schema.prisma`, `package.json` (Skript `moved`), `.env.example`
(`SPIEGEL_URL=http://localhost:3002`), `src/types/next-auth.d.ts`, `src/lib/auth.ts`, `src/lib/auth-helpers.ts`
(+ Test), die fünf Fassaden `src/lib/{sessions,goals,shot-routines,disciplines,account}/actions.ts`,
`src/lib/disciplines/actions/getDisciplines.ts` (+ Test), `src/app/(app)/layout.tsx`,
`src/components/app/shell/AppShell.tsx`, `areas.ts`, die Seiten `dashboard`, `sessions`, `sessions/new`,
`sessions/[id]`, `sessions/[id]/edit`, `goals`, `goals/new`, `goals/[id]`, `shot-routines`, `shot-routines/new`,
`shot-routines/[id]`, `shot-routines/[id]/edit`, `disciplines`, `disciplines/new`, `disciplines/[id]`,
`disciplines/[id]/edit`, `profile`; die Komponenten `sessions/detail/SessionDetailHeader.tsx`,
`SessionDetailHeaderActions.tsx`, `sessions/AttachmentSection.tsx`, `WellbeingSection.tsx`, `PrognosisSection.tsx`,
`FeedbackSection.tsx`, `ReflectionSection.tsx`, `goals/GoalCardSection.tsx`, `profile/ProfileScreen.tsx`,
`disciplines/DisciplineForm.tsx`; `tools/pruefen-account.ts`, `tools/pruefen.ts`, `CLAUDE.md`.

Deploy (Diff an die Koordination): `compose.yml` (geschützt) bei `app-treffsicher`: `SPIEGEL_URL:
https://${SPIEGEL_HOST}`; `compose.local.yml` bei Treffsicher `SPIEGEL_URL: "http://localhost:3002"`;
`tools/stack-e2e/compose.e2e.yml` bei Treffsicher `SPIEGEL_URL: "http://localhost:18082"` (wie dort `NEXTAUTH_URL`, denn
`SPIEGEL_HOST=:8082` ergäbe keine gültige Adresse). Keine neue Variable in der Root-`.env.example`: `SPIEGEL_HOST` ist
schon Pflicht.

Vault: neu `vault/apps/treffsicher/treffsicher-read-only.md`; geändert `treffsicher.md` (MOC),
`treffsicher-data-model.md` (Feld `User.movedToSpiegelAt`, Variable `SPIEGEL_URL`), `treffsicher-design2.md` (Rahmen:
Aktion umgezogen; Skriptprüfung: Abschnitt „Nur lesend“), `treffsicher-access-model.md` (Satz und Link),
`vault/_attachments/textbuch-ringwerk-treffsicher.md`, `vault/index.md` (neue Note, falls `vault-lint` sie verlangt).

Nicht berührt: Spiegel, Brücke, Vertrag, `Caddyfile`, `Dockerfile`, `db-init/`, `scripts/`, die geteilten Dateien der
Apps (`error.tsx`, `not-found.tsx`, `globals.css`, `components.json`: Drift-Gate §1), `packages/*`, `vault/decisions/`.
**Keine neue Brücke.**

## Required Docs

- `vault/conventions.md` §1 (byte-gleiche Dateien, hier nicht berührt), §2 (Seitenkopf, `DetailActionBar`,
  `EmptyState`), §3 (Kontrast), §4 (Tokens statt Palette, Akzent über `data-app`), §8 (Drift-Gate), §9 („Fest breite
  Elemente … ein Prädikat“, „Markup ist auch ohne jsdom testbar“, „Mocks für Abfragen filtern nach der Bedingung“,
  „Aussagen über UI-Pfade an der UI prüfen“, „Ein Feld fester Breite … am Telefon“), §10 („So schreiben wir“)
- `vault/decisions/adr-033.md` („Weg in vier Stufen“, Punkte 3 und 4), `adr-002.md` (keine Abfrage quer über
  Datenbanken), `adr-023.md` (geschützte Pfade)
- `apps/treffsicher/CLAUDE.md`, `vault/apps/treffsicher/treffsicher-design2.md`, `treffsicher-data-model.md`
  („Umgebungsvariablen“, „Nutzerverwaltung & Rollen“), `treffsicher-access-model.md`
- `plans/2026-10-26-treffsicher-in-spiegel.md` („Regeln für Kindsessions“, Stufe 3)
- Code: `src/lib/auth-helpers.ts` (+ Test), die sechs Fassaden und ihre Tests (`src/lib/sessions/actions.test.ts` als
  Muster für Mocks), `src/components/app/shell/AppShell.tsx`, `areas.ts`, `packages/ui/src/design2/app-frame.tsx`
  (`renderLink`, `action`), `src/components/app/confirmations.test.tsx` (Markup-Tests ohne DOM), `tools/pruefen.ts`,
  `tools/pruefen-account.ts`

## Aufgaben

1. **Schema und Migration (geschützt, Circuit-Breaker).** Feld oben in `prisma/schema.prisma`, SQL über `migrate diff`
   (siehe Ansatz), Diff und SQL an die Koordination. Nach OK: `migrate deploy` auf Dev. **Probe Rückweg**, bevor
   `db:generate` den Client erneuert: Skript im Scratchpad (nicht im Repo), das mit dem alten Client aus
   `src/generated/prisma` gegen die lokale Datenbank ein Konto `rollback-probe@treffsicher.test` anlegt
   (`db.user.create`), es liest (`findUnique` ohne `select`) und löscht; erwartet: kein Fehler, die Zeile hat
   `movedToSpiegelAt` NULL (Gegenprobe per `$queryRaw`). Ergebnis in den Bericht, Skript weg. Danach
   `pnpm --filter treffsicher db:generate`. Commit `feat(treffsicher): remember per account that it moved to spiegel`.
2. **Merkmal in der Sitzung.** `auth-helpers.ts`, `auth.ts`, `next-auth.d.ts` wie oben. Tests in
   `auth-helpers.test.ts`: Zeile mit `movedToSpiegelAt: new Date()` → `movedToSpiegel` true, mit null → false; das
   `select` enthält `movedToSpiegelAt` (Mock prüft die Argumente). Commit `feat(treffsicher): session knows a moved
   account`.
3. **Texte und Regeln.** `src/lib/moved/texts.ts` (`MOVED_TEXTS`: `bannerTitle`, `bannerText`, `signIn`, `bannerShort`,
   `toSpiegel`, `toSpiegelShort`, `refusal`, `pageTitle`, `emptyHint`, `password`, `newSystemDiscipline`;
   `MOVED_PAGES: Record<MovedPageKind, { title: string; text: string }>` mit den sieben Arten). `rules.ts` wie oben.
   Tests: `texts.test.ts` hält jeden Satz der Tabelle wörtlich und prüft alle Texte mit
   `forbiddenIn(…, TREFFSICHER_OLD_WORDS)` (Semikolon, drei Punkte, alte Wörter) → `[]`; `rules.test.ts`:
   `disciplineWritable` für alle acht Fälle (umgezogen ja/nein × Admin ja/nein × System ja/nein, nur „umgezogen, kein
   Admin oder keine Systemdisziplin“ ist false), `spiegelUrl`: `https://spiegel.example.com/x` → `https://spiegel.example.com`,
   `http://localhost:18082` bleibt, `ftp://a`, `https://:8082`, leer und `undefined` → in Dev `http://localhost:3002`,
   in Produktion `null`. Commit `feat(treffsicher): texts and rules for a moved account`.
4. **Prüfung im Server.** `guard.ts` wie oben; die Prüfung als erste Zeile in jede Fassade aus der Tabelle (22 Actions
   `refuseIfMoved`, 5 Actions `refuseDisciplineIfMoved`: `createDiscipline` mit `{ isSystem: formData.get("isSystem")
   === "true" }`, die vier übrigen mit `{ id }`); `getFavouriteDisciplineIdAction` ohne Aufräumen für umgezogene Konten
   (Test in `getDisciplines.test.ts`: umgezogen und verwaister Favorit → `null`, kein `user.update`).
   Tests:
   - `guard.test.ts`: `refuseIfMoved` ohne Sitzung, nicht umgezogen, umgezogen; `refuseDisciplineIfMoved` mit
     `{ isSystem }` und mit `{ id }` (Mock `discipline.findUnique` liefert je nach `where.id` System, eigene, keine),
     umgezogenes Mitglied an System → Ablehnung, umgezogener Admin an System → null, an eigener → Ablehnung, fehlende
     Disziplin → null.
   - `coverage.test.ts` (der Test über alle Actions): Er liest rekursiv alle `.ts`/`.tsx` unter `src` (ohne Tests und
     `src/generated`) und erwartet genau die sechs Fassaden mit `"use server"`. Je Fassade eine Tabelle `Record<Name,
     "own" | "discipline" | "admin" | "read">` wie oben; die Namen der exportierten Funktionen (`Object.entries` des
     Moduls, `typeof v === "function"`) müssen genau die Schlüssel der Tabelle sein. Eine neue Action ohne Eintrag macht
     den Test rot. Mocks wie in `sessions/actions.test.ts` (`vi.hoisted` + Fabrik je internem Modul, Namen `<name>Action`),
     dazu `@/lib/auth-helpers`, `@/lib/db` (Schreibmethoden als Spione, `findFirst`/`findUnique` → `null`),
     `next/cache`, `next/navigation` (`redirect` wirft einen Marker), `bcryptjs`. Aufruf jeder Action mit
     `Math.max(fn.length, 1)` leeren `FormData` als Argumenten. Erwartet:
     - `own`, umgezogen: Ergebnis `{ error: MOVED_TEXTS.refusal }` (bei `createGoalAndRedirect` der Marker mit
       `/goals/new`), die interne `…Action` nicht gerufen, keine Schreibmethode von `db` gerufen;
     - `own`, nicht umgezogen: die interne `…Action` einmal gerufen bzw. (Abläufe, Passwort) kein Ergebnis mit dem Satz
       der Ablehnung;
     - `read` und `admin`, umgezogen: die interne `…Action` gerufen, kein Ergebnis mit dem Satz der Ablehnung;
     - `discipline`: die fünf Fälle aus `guard.test.ts` über die Fassade (`createDiscipline` mit `isSystem` true und
       false, `updateDiscipline` an System und eigener Disziplin, je Mitglied und Admin).
     Gegenprobe vor dem Commit: die Prüfung in einer Fassade (`toggleFavourite`) testweise auskommentieren → der Test wird
     rot; Datei aus einer Kopie zurücksetzen, nicht per `git checkout`. Ergebnis in den Bericht.
   Commit `feat(treffsicher): refuse every own change of a moved account on the server`.
5. **Hinweis und Rahmen.** `MovedBanner.tsx` (rein + Host), Layout, `AppShell` mit `moved`, `currentArea` in
   `areas.ts`. Tests: `read-only.test.tsx` (`renderToStaticMarkup`): voller Hinweis mit Titel, Satz, Link
   `href="http://localhost:3002"` und leiser Zeile; kurzer mit dem einen Satz und dem Link; ohne Adresse kein `<a`; keine
   Klasse aus der Tailwind-Palette und kein `dark:` im Markup. `areas.test.ts`: `currentArea("/sessions/new", true)` →
   `sessions`, `(…, false)` → `new`, `/dashboard` → `start` in beiden. `AppShell` als Markup (mit `next/navigation`
   gemockt): umgezogen trägt `[data-area="new"]` `href` der Adresse und `aria-label="Zu Spiegel"`, nicht umgezogen
   `/sessions/new`. Commit `feat(treffsicher): notice and frame for a moved account`.
6. **Knöpfe weg, Seiten statt Formularen.** Tabellen oben. `MovedPage.tsx`; Props `readOnly` an
   `SessionDetailHeader`, `SessionDetailHeaderActions`, `AttachmentSection`, den vier Abschnitten, `GoalCardSection`;
   `moved` an `ProfileScreen`; `systemOnly` an `DisciplineForm`. Markup-Tests in `read-only.test.tsx`:
   `SessionDetailHeaderActions` mit `readOnly` hat den Link auf `/export/pdf` und `/sessions`, keinen auf `/edit`, keinen
   Knopf „Löschen“, keinen Favoriten; ohne `readOnly` wie heute; `AttachmentSection` mit `readOnly` ohne `type="file"`
   und ohne „entfernen“; `WellbeingSection` mit und ohne Daten ohne Knopf; `GoalCardSection` ohne „Bearbeiten“ und
   „Löschen“, mit Zurück; `ProfileScreen` umgezogen ohne `name="currentPassword"`, mit dem Satz; `MovedPage` je Art mit
   Titel, „Das geht jetzt in Spiegel.“ und Satz; `DisciplineForm` mit `systemOnly` hat `name="isSystem" value="true"`
   und keine Auswahl. Datei wird sie länger als 200 Zeilen: nach Seiten aufteilen (`read-only-session.test.tsx`,
   `read-only-other.test.tsx`). Commit `feat(treffsicher): read-only pages for a moved account`.
7. **Werkzeug und Skriptprüfung.** `tools/moved.ts` mit `setMovedByEmail`, Skript `"moved": "tsx tools/moved.ts"`.
   `prepareTestAccounts` setzt in `update` aller drei Prüfkonten `movedToSpiegelAt: null`. Neuer Abschnitt `movedFlow`
   in `tools/pruefen-moved.ts`, in `main()` als letzter Abschnitt nach „Konto deaktivieren“ (`section("Nur lesend", …)`),
   mit `try … finally`, das beide Prüfkonten wieder auf NULL setzt:
   - `setMovedByEmail(testDb(), PRUEFEN_EMAIL, true)`, Mitglied anmelden;
   - `/dashboard`: `[data-moved-banner="full"]` mit Titel und `a[data-moved-link]` (Ziel beginnt mit `http`);
     `[data-area="new"]` in Leiste und Seitenleiste führt nicht auf `/sessions/new`;
   - `/sessions`, die neueste Einheit, `/goals`, `/shot-routines`, `/disciplines`, `/statistics`, `/profile`: je
     `[data-moved-banner="short"]`; auf der Einheit kein `a[href$="/edit"]`, kein `input[type=file]`, kein Knopf mit
     „Bearbeiten“ oder „erfassen“, der Link `…/export/pdf` da; Profil ohne `input[name=currentPassword]`;
   - `/sessions/new`, `/sessions/<neueste>/edit`, `/goals/new`, `/shot-routines/new`: `[data-moved-page]`, kein `form`;
   - bei 390 und 360 px auf `/dashboard` und der Einheit kein seitliches Scrollen (`noSideScroll` aus
     `@vereinsheim/pruefen/common`);
   - Admin: `setMovedByEmail(…, PRUEFEN_ADMIN_EMAIL, true)`, Admin anmelden: `/admin` zeigt die Konten und den Knopf
     „Neuer Nutzer“, `/admin/users/new` hat ein `form`, `/disciplines/new` hat `input[name=isSystem][value=true]` und
     keine Auswahl „Sichtbarkeit“.
   Commit `test(treffsicher): script check for a moved account`.
8. **Deploy-Vertrag (geschützt, Diff an die Koordination).** `compose.yml`, `compose.local.yml`,
   `tools/stack-e2e/compose.e2e.yml`, `apps/treffsicher/.env.example` wie unter „Dateien“. Prüfen:
   `docker compose --env-file .env.example config --quiet` an der Wurzel, dasselbe mit `-f compose.yml -f
   compose.local.yml` und mit `-f compose.yml -f tools/stack-e2e/compose.e2e.yml`. Commit nach OK
   `feat(treffsicher): spiegel address for the read-only notice`.
9. **Im Browser prüfen** (siehe Verifikation), Befunde fixen.
10. **Doku.** `apps/treffsicher/CLAUDE.md` (neuer Abschnitt „Konto umgezogen“: Merkmal, `refuseIfMoved` als erste Zeile
    jeder Fassade, `coverage.test.ts`, `readOnly`-Props, `moved`-Werkzeug, `SPIEGEL_URL`); Vault-Note
    `treffsicher-read-only.md` (Frontmatter nach `vault/SCHEMA.md`: `type: subsystem`, `part_of: ["[[treffsicher]]"]`,
    `governed_by: ["[[adr-033]]"]`, `relates_to: ["[[treffsicher-design2]]", "[[treffsicher-access-model]]"]`, `keywords`
    einzeilig: umgezogen, nur lesend, lesend je konto, zu spiegel, übernahme, moved, movedToSpiegelAt, SPIEGEL_URL,
    hinweis, admin bleibt; Inhalt: Grenze eigene Daten gegen Admin, Tabelle der Schreibwege kurz, Vertrag für 3a, Rückweg);
    die übrigen Notes wie unter „Dateien“, Textbuch-Abschnitt. Keine Prettier-Formatierung auf `vault/`. `vault-lint`
    grün. Commit `docs(treffsicher): read-only per moved account`.
11. Letzter Commit: diesen Plan entfernen (`chore: remove the implemented read-only plan`).

### Entwurf Nachtrag ADR-033 (für 3b, nicht in 3e)

```markdown
## Nachtrag (… 2026): Übernahme je Konto, Treffsicher lesend je Konto (3a, 3b, 3e)

Verfeinert „Konten ordnen sich über die E-Mail zu“ und „Treffsicher läuft erst nur lesend“ (Stufe 3 und 4).

- **Lesend je Konto, nicht als Ganzes:** Treffsicher merkt sich je Konto, dass es umgezogen ist
  (`User.movedToSpiegelAt`). Gesetzt und aufgehoben nur von der Übernahme, nie von der App. Ein umgezogenes Konto liest
  alles, ändert nichts (auch nicht das Passwort), der Server lehnt jede Änderung an eigenen Daten ab. Ein Hinweis oben
  auf jeder Seite führt zu Spiegel; das PDF einer Einheit bleibt.
- **Admin bleibt** für Admins bedienbar, auch wenn ihr eigenes Konto umgezogen ist: Konten und Disziplinen der Anlage,
  solange andere noch in Treffsicher arbeiten.
- **Anmelden bleibt**, keine Weiterleitung, bis alle umgezogen sind (Stufe 4).
- Gebaut in 3e ([[treffsicher-read-only]]).
```

## Tests und Verifikation

- Vorbedingung im Worktree: `apps/treffsicher/.env` aus dem Haupt-Checkout verlinken (nur mit `[ -e … ] ||`), Node 26 im
  `PATH`. In der verlinkten `.env` steht kein `SPIEGEL_URL`; der Dev-Fallback `http://localhost:3002` gilt.
- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller Apps), `vault-lint` grün,
  `scripts/consistency-check.sh` grün (keine Palette, kein `dark:`, keine ASCII-Ellipse). Das Stop-Gate prüft den
  Haupt-Checkout: das Gate im Worktree selbst laufen lassen.
- Browser: Dev-Server aus dem Worktree auf Port **3026** (`pnpm --filter treffsicher exec next dev --webpack --port
  3026`, ein geschriebenes `AGENTS.md` danach löschen). Die Kindsession setzt das Merkmal am Prüfkonto
  (`pnpm --filter treffsicher moved pruefen@treffsicher.test`, vorher einmal `pnpm --filter treffsicher pruefen:konto`,
  falls das Konto fehlt); der User meldet sich im Pane selbst mit dem Prüfkonto an (Zugang in `apps/treffsicher/.env`,
  die Session liest die Datei nicht). Echte Konten werden nicht verändert. Telefon (390 und 360 px) und Desktop, hell und
  dunkel:
  - Start mit vollem Hinweis, jede Hauptseite mit kurzem, Teal in beiden Darstellungen, Kontrast der leisen Zeile;
  - Leiste: runde Aktion mit Pfeil, Seitenleiste „Zu Spiegel“, ein Tipp öffnet `http://localhost:3002` im selben Tab;
  - Einheit mit Anhängen, Befinden, Prognose, Feedback, Reflexion: keine Knöpfe zum Ändern, PDF öffnet;
  - `/sessions/new`, `/sessions/<id>/edit`, `/goals/new`, `/shot-routines/new`, `/disciplines/new`: Seite „Das geht jetzt
    in Spiegel.“;
  - Profil ohne Passwortformular; Abmelden und wieder Anmelden geht;
  - Gegenprobe: nach `moved --clear` sieht dasselbe Konto alles wie vorher (Knöpfe, Formulare, kein Hinweis);
  - Admin-Prüfkonto umgezogen: Admin, Konten, „Neue System-Disziplin“ gehen.
  Danach `pnpm --filter treffsicher moved --clear pruefen@treffsicher.test` (und das Admin-Prüfkonto).
- Skriptprüfung `BASE_URL=http://localhost:3026 pnpm --filter treffsicher pruefen` **nur auf Signal der Koordination**
  (Dev-Datenbank und Ports teilen sich die Sessions), mit dem Befehl, den die Koordination nennt; danach dürfen die
  Prüfkonten nicht umgezogen sein (`finally`, Gegenprobe mit `moved`).
- Release (nicht in der Kindsession): Treffsicher allein (`APPS=treffsicher`) vor dem ersten Umzug, vorher
  `tools/stack-e2e/run.sh` grün auf `main`; nach dem Deploy `SPIEGEL_URL` im Container prüfen (`vereinsheim shell`
  bzw. `docker compose exec app-treffsicher printenv SPIEGEL_URL`).
- Nicht belegt bleibt voraussichtlich: Schicken einer alten, schon offenen Seite (Formular vor dem Umzug geöffnet,
  danach abgeschickt) im Browser; belegt durch `coverage.test.ts` (Ablehnung auf dem Server).

## Offene Punkte für den Koordinator (Empfehlung zuerst)

**Entschieden am 29. Oktober 2026:** Das Konzept ist vom User mit allen Empfehlungen freigegeben. Die Punkte unten hat
der Koordinator so entschieden, wie sie empfohlen sind: voller Hinweis auf Start, eine Zeile auf allen anderen Seiten,
die Seite „Das geht jetzt in Spiegel.“ ohne eigenen Knopf, `SPIEGEL_URL` über `compose.yml` (geschützt, Diff an den
Koordinator), Werkzeug `moved` für Dev, Admin voll bedienbar, Nachtrag zu ADR-033 erst in 3b, Release von Treffsicher
vor dem ersten Umzug und zusammen mit 3c, kein Zustand im Admin, `ArrowUpRight` in conventions §4 ergänzen. Abweichungen
davon meldet die Kindsession und wartet.

1. **Zwei Inhalte des Hinweises:** **Empfehlung:** voll auf Start (dort landet jede Anmeldung), auf allen anderen
   Seiten eine Zeile „Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nur noch lesen.“ mit Knopf, gleicher Aufbau und
   Ort. Abweichung vom Konzept: Dort hieß die Kurzform „Nur noch zum Lesen.“; neu sagt sie erst, was passiert ist
   (Schreibregel 1).
2. **Seite „Das geht jetzt in Spiegel.“ ohne eigenen Knopf** (Konzept: Knopf in der Karte). **Empfehlung:** ohne, weil
   der Hinweis direkt darüber „Zu Spiegel“ trägt; zwei gleiche Knöpfe untereinander wären doppelt.
3. **Adresse von Spiegel:** **Empfehlung:** Variable `SPIEGEL_URL` (in `compose.yml` aus `SPIEGEL_HOST`), weil
   `TREFFSICHER_HOST` frei gewählt ist (`training.example.com`) und sich `spiegel.<domain>` nicht ableiten lässt. Ziel ist
   die Wurzel von Spiegel; `/diary` erst, wenn das Tagebuch in `main` ist (in `main` gibt es `/diary` noch nicht, und
   bei ausgeschaltetem Tagebuch führt es ins Profil). Fehlt die Variable in Produktion, zeigt Treffsicher den Hinweis
   ohne Knopf statt eines falschen Links. Diff an `compose.yml` ist geschützt.
4. **Werkzeug statt SQL:** **Empfehlung:** `tools/moved.ts` (nur lokal); 3a setzt das Merkmal in seinem Lauf per SQL,
   der Befehl zum Aufheben kommt mit 3a/3b. Der Vertrag (Spalte, Werte) steht in der Vault-Note.
5. **Admin an umgezogenen Konten:** **Empfehlung:** Der Admin darf weiter alles im Admin-Bereich, auch das Passwort
   eines umgezogenen Kontos zurücksetzen (ein Mitglied, das sein Passwort für Treffsicher vergessen hat, will noch
   nachlesen). Ein umgezogener Admin legt nur Disziplinen der Anlage an und ändert nur diese; seine eigenen nicht.
6. **„Konto löschen“** gibt es in Treffsicher nicht; nichts zu sperren. **`previewMeytonImport`** schreibt nichts, wird
   aber abgelehnt, weil es nur zum Anlegen dient. **Aufräumen des Favoriten** beim Lesen unterbleibt für umgezogene
   Konten.
7. **Nachtrag zu ADR-033:** **Empfehlung:** in 3b (Basisbranch), zusammen mit der Zuordnung je Konto, wie im
   Koordinationsplan. `main` kennt die Nachträge 2a bis 2c noch nicht; ein Nachtrag aus 3e kollidierte beim Rebase des
   Basisbranchs. 3e dokumentiert in `treffsicher-read-only.md`; Entwurf oben.
8. **Release und Rückweg:** **Empfehlung:** Treffsicher allein, bald nach dem Merge, sicher vor dem ersten Umzug in
   Prod. Ein Rückweg auf ein älteres Image ist vor dem ersten Umzug folgenlos (Spalte wird ignoriert). Nach dem ersten
   Umzug macht er umgezogene Konten wieder beschreibbar; dann nur mit erneutem Lauf der Übernahme für diese Konten.
   Vor dem Rückweg nichts löschen.
9. **Zustand „umgezogen“ im Admin von Treffsicher:** **Empfehlung:** nicht in 3e. Wer umgezogen ist, zeigt `status` aus
   3b; der Admin von Treffsicher bleibt, wie er ist.
10. **Aktion in der Mitte:** Symbol `ArrowUpRight` (nicht im Vokabular von §4, das kein Symbol für „zu einer anderen
    App“ hat), unter dem Symbol „Spiegel“, öffnet im selben Tab. **Empfehlung:** so; §4 um „Zu Spiegel |
    `ArrowUpRight`“ ergänzen, falls gewünscht (Konvention, geteilt).
11. **Dev-Datenbank:** Die Migration ändert die geteilte Dev-Datenbank von Treffsicher. Der Haupt-Checkout und andere
    Worktrees mit altem Client lesen weiter (Spalte wird ignoriert). Kein anderer Teil ändert gerade das Schema von
    Treffsicher (3c ändert nur Spiegel).

Keine neue Brücke. Migration ja (additiv, geschützter Pfad). Geschützt: `apps/treffsicher/prisma/schema.prisma`,
`apps/treffsicher/prisma/migrations/20261029160000_user_moved_to_spiegel/`, `compose.yml`; Kommandos `prisma migrate
diff|deploy|resolve`.
