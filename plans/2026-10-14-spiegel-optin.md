# Spiegel: Zustimmung durch den Schützen selbst (SP-1.7 a1)

## Kontext

Bestandsaufnahme vom 14. Oktober 2026 (Ziel: bald deployen). SP-0.5 entfällt (User, 14. Oktober 2026): Einen
Einwilligungstext vom Vorstand gibt es nicht; der Schütze bestätigt einen eigenen Hinweistext von Spiegel selbst
([[spiegel-privacy]]). Heute trägt der Admin SportpassIDs „nach der Zustimmung auf Papier“ ein (`addSportpass`, SP-1.6 b);
eine Zustimmung, die Spiegel belegen kann, gibt es nicht.

Dieser Plan ist P1 von zwei. **P1:** Schema für beide Teile, Zustimmung im Profil, Bestätigen und Ablehnen durch den Admin,
offene Anfragen. **P2** (`SP-1.7 a2`, eigener Plan): `ownerPending` beim Einlesen, Übersichten blenden ausstehende Scheiben
aus, „Offen“ mit „Ja, meine“ und „Nicht meine“, Scannen aus der Navigation. Das Schema kommt ganz in P1, damit die eine
Migration nur einmal neu entsteht.

Entscheidungen des Users (14. Oktober 2026): Widerruf → hochgeladene Scheiben bleiben, der Schütze kann sie selbst
löschen. „Nicht meine“ bei der ersten Scheibe → Grabstein, die Zustimmung geht zurück an den Admin (P2). Den Hinweistext v1
entwirft Claude (D3), der User gibt ihn mit diesem Plan frei. Nach dem Deploy hat der QR-Weg Priorität eins (Doku, T9).

**Geschützte Pfade** (Prisma-Schema): interaktiv, nicht im Autopilot.

## Entscheidungen

- **D1 Zustände einer Zustimmung** als reine Funktion `consentStatus` (`src/lib/consent/status.ts`) aus den Spalten:
  - `requested`: der Schütze hat zugestimmt (`consentedAt`), der Admin hat noch nicht entschieden;
  - `active`: vom Admin bestätigt (`confirmedAt`); nur diese gehen an die Brücke (`GET /state`) und ins Einlesen, wie
    heute (`confirmedAt: { not: null }`, unverändert);
  - `rejected`: vom Admin abgelehnt (`rejectedAt`);
  - `returned`: zurück beim Admin nach „Nicht meine“ bei der ersten Scheibe (`returnedAt`, gesetzt erst in P2; P1 zeigt
    den Zustand schon an). Der Admin kann erneut bestätigen oder ablehnen.
  Vorrang: `rejectedAt` > `confirmedAt` > `returnedAt` > sonst `requested`. Bestätigen setzt `confirmedAt` und löscht
  `returnedAt`; Zurückgeben (P2) setzt `returnedAt` und löscht `confirmedAt` und `firstCardConfirmedAt`.
- **D2 Schema** (`SportpassConsent`, `Card`):
  - `consentedAt DateTime @default(now()) @db.Timestamptz(3)`: wann der Schütze zugestimmt hat;
  - `consentVersion String @default("v1")`: Version des Hinweistexts. Abweichend von der Skizze („consentText“) steht der
    Text nicht in der Zeile, sondern unveränderlich im Code (`CONSENT_TEXTS`), ein Test schreibt den Hash von v1 fest.
    So belegt jede Zeile, welchem Wortlaut zugestimmt wurde, ohne den Text tausendfach zu speichern; ein neuer Wortlaut
    ist eine neue Version, nie eine Änderung an v1;
  - `rejectedAt DateTime? @db.Timestamptz(3)`, `returnedAt DateTime? @db.Timestamptz(3)`;
  - `firstCardConfirmedAt DateTime? @db.Timestamptz(3)`: erste Scheibe bestätigt (gesetzt in P2);
  - `Card.ownerPending Boolean @default(false)`: Besitz wartet auf die Bestätigung der ersten Scheibe (gesetzt in P2).
  Bestehende Aufrufer (`ingest-load`, `bridge-e2e`, Tests) legen Zustimmungen weiter mit `confirmedAt` an; die Defaults
  machen sie gültig.
- **D3 Hinweistext v1** (`CONSENT_TEXTS.v1`, zur Freigabe durch den User):

  > **Deine Scheiben automatisch in Spiegel**
  >
  > Wenn du zustimmst, schickt die Brücke im Schützenhaus jede Scheibe, die du unter dieser SportpassID an der
  > Meyton-Anlage schießt, an Spiegel: jeden Schuss mit Lage, Wert und Zeit, dazu Stand, Disziplin und den Namen, unter
  > dem Meyton dich führt. Scheiben mit verdeckter Wertung (etwa beim Königsschießen) verlassen das Schützenhaus nie.
  >
  > Spiegel betreibt der Verein. Deine Scheiben siehst nur du; ein Admin verwaltet Konten und Anlage, aber nicht deine
  > Schüsse. Ein Admin bestätigt deine SportpassID einmal, danach legt dir Spiegel die erste Scheibe zur Bestätigung vor.
  >
  > Deine Scheiben bleiben, bis du sie löschst; gelöschte liegen 30 Tage im Papierkorb und verschwinden danach. In den
  > Sicherungen des Servers stehen sie noch rund zwei Wochen länger.
  >
  > Die Zustimmung ist freiwillig, und du kannst sie hier jederzeit widerrufen. Danach kommen keine neuen Scheiben mehr;
  > was schon da ist, bleibt, bis du es löschst.

  Die Fakten dahinter: Snapshot mit allen Spalten (`SELECT *`, [[spiegel-bridge]]), verdeckt nie (SF-19), privat ist
  Standard und Admin ohne Schussbilder ([[spiegel-privacy]]), Papierkorb 30 Tage ([[spiegel-navigation]]), Backups 14
  Tage mit mindestens sieben Ständen ([[nightly-backup-cron]]). Keine Rechtsberatung.
- **D4 Profil** (`ProfileScreen`, Abschnitt „Sportpass“): je SportpassID Status in Worten („wartet auf den Admin“,
  „aktiv seit …“, „abgelehnt“, „zurück beim Admin“) und eine Aktion:
  - `requested` und `active`: „Widerrufen“ mit `ConfirmDialog` (destruktiv): löscht die Zeile (`revokeSportpass`); die
    Scheiben behalten ihren Besitzer. Ab dem nächsten `GET /state` lädt die Brücke nichts mehr (SF-38);
  - `rejected`: „Entfernen“ (dieselbe Action), damit der Schütze neu eintragen kann;
  - `returned`: „Widerrufen“ wie oben.
  Darunter das Formular: SportpassID (`value` + `onChange`), der Hinweistext v1 aufgeklappt, eine Checkbox „Ich habe den
  Hinweis gelesen und stimme zu“, „Zustimmen“. Ohne Haken lehnt die Action ab (Feldfehler am Haken), nicht nur der Knopf.
  Höchstens drei SportpassIDs je Konto (SF-39 braucht mehrere, mehr ist Missbrauch).
- **D5 Admin:** `SportpassSection` in `/admin/users/[id]` zeigt dieselbe Liste mit Status und „Bestätigen“ / „Ablehnen“
  (bei `requested` und `returned`) bzw. „Entfernen“ (bei allen). Das Formular zum Eintragen entfällt: Eine Zustimmung
  kommt nur vom Schützen. Der Hinweis im Abschnitt: „Bestätige nur, wenn die Nummer in der Meyton-Schützenverwaltung zu
  dieser Person gehört.“ (SF-34; den Namen aus der SSMDB2 sieht Spiegel erst mit der ersten Scheibe, P2). `/admin/users`
  bekommt oben „Offene Zustimmungen (n)“ mit Konto, SportpassID, Datum und Link aufs Konto (`requested` und `returned`);
  ohne offene der Satz „Keine offenen Zustimmungen.“ im Abschnitt (kein Leerzustand-Baustein nötig, er steht in einer
  Karte).
- **D6 Actions** (`src/lib/consent/actions.ts`, `ActionResult`, nie werfen, danach `revalidatePath`):
  - Schütze: `requestSportpass(_prev, formData)` (Sitzung über `action-guards`, Anlage = erste, Prüfung wie
    `SportpassSchema`, Haken, höchstens drei; `P2002` → „Diese SportpassID ist schon vergeben. Wende dich an einen
    Admin.“), `revokeSportpass(consentId)` (nur eigene: `deleteMany({ where: { id, userId } })`, 0 Zeilen → Fehler);
  - Admin: `confirmConsent(consentId)` (`updateMany` mit Bedingung `rejectedAt: null` und
    `confirmedAt: null`, setzt `confirmedAt`, löscht `returnedAt`; 0 Zeilen → „Schon entschieden.“), `rejectConsent`
    (Bedingung `rejectedAt: null`, setzt `rejectedAt`, löscht `confirmedAt`), `removeConsent` (wie heute
    `removeSportpass`). `addSportpass` und `removeSportpass` entfallen aus `site-actions.ts`.
- **D7 Lesen** (`src/lib/consent/queries.ts`): `consentRows(userId, timeZone)` mit Status (aus `admin/site.ts`
  hierher), `consentsOfUser` (Admin, `requireAdmin`), `openConsents(timeZone)` (Admin). `ConsentRow` bekommt `status`,
  `consentedAt`, `consentVersion`.

## Nicht in diesem Plan

P2 (ownerPending, Übersichten, „Offen“, „Nicht meine“, Scannen ausblenden). Benachrichtigung des Admins außerhalb der
App. Name aus der SSMDB2 beim Bestätigen (Datensparsamkeit: vor der Zustimmung kommt keine Scheibe). Rückwirkendes
Nachladen (SP-2.5).

## Required Docs

- `apps/spiegel/CLAUDE.md` (Regeln: Migration bis SP-1.9, Formulare gesteuert, Admin prüft selbst, Ingest „nichts ohne
  Zustimmung“)
- `vault/spiegel/spiegel-assignment.md` (Opt-in per Sportpass), `vault/spiegel/spiegel-privacy.md`,
  `vault/spiegel/spiegel-db-schema.md`
- `vault/conventions.md` §2 (ConfirmDialog, Feldfehler; Spiegel ohne Toasts), §10 (Design 2)
- `apps/spiegel/src/components/admin/SiteForms.tsx` und `SportpassSection.tsx` (Muster für Actions, Fehler, Dialog)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/prisma/schema.prisma` | D2 |
| `apps/spiegel/prisma/migrations/20261010175045_init/migration.sql` | neu erzeugt |
| `apps/spiegel/src/lib/consent/texts.ts` (neu) | `CONSENT_TEXTS`, `CURRENT_CONSENT_VERSION = "v1"` |
| `apps/spiegel/src/lib/consent/status.ts` (neu) + Test | `consentStatus`, `consentStatusText` |
| `apps/spiegel/src/lib/consent/actions.ts` (neu) + Test | D6 |
| `apps/spiegel/src/lib/consent/queries.ts` (neu) + Test | D7 |
| `apps/spiegel/src/lib/admin/site.ts`, `site-actions.ts` (+ Test) | Zustimmungen heraus |
| `apps/spiegel/src/components/profile/ProfileScreen.tsx`, `ConsentForm.tsx` (neu) | D4 |
| `apps/spiegel/src/components/admin/SportpassSection.tsx`, `OpenConsents.tsx` (neu) | D5 |
| `apps/spiegel/src/app/(app)/profile/page.tsx`, `admin/users/page.tsx`, `admin/users/[id]/page.tsx` | Daten durchreichen |
| `apps/spiegel/src/lib/ingest/bridges.test.ts` | `requested`, `rejected`, `returned` nicht in `GET /state` |
| `apps/spiegel/CLAUDE.md`, Vault-Notes | T9 |

## Aufgaben

**T1 Schema und Migration** (interaktiv)
1. D2 in `schema.prisma`, Kommentare wie in der Datei üblich (ein Satz je Spalte).
2. `pnpm --filter spiegel exec prisma generate`.
3. Migration ersetzen: `pnpm --filter spiegel exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma
   --script`, ohne `CREATE SCHEMA`-Zeilen, nach `…_init/migration.sql`.
4. Gegenprobe im Wegwerf-Postgres: `docker run -d --rm --name spiegel-diff -e POSTGRES_PASSWORD=x -p 55432:5432
   postgres:15-alpine`, `DATABASE_URL=postgresql://postgres:x@localhost:55432/postgres pnpm --filter spiegel exec prisma
   migrate deploy`, dann `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` mit
   derselben URL → muss leer sein (nur Kommentar). Container stoppen.
5. Dev-Datenbank additiv: `ALTER TABLE "SportpassConsent" ADD COLUMN …` (fünf Spalten, Defaults wie D2) und
   `ALTER TABLE "Card" ADD COLUMN "ownerPending" BOOLEAN NOT NULL DEFAULT false` per `docker exec -i … psql -U spiegel
   spiegel` (mit `-i`, Memory: sonst wird stdin verschluckt), danach `\d "SportpassConsent"` prüfen. Den Reset macht der
   User nach dem Merge.

**T2 Texte und Status** (`texts.ts`, `status.ts`)
- `CONSENT_TEXTS: Record<string, { title: string; paragraphs: string[] }>` mit v1 aus D3; `CURRENT_CONSENT_VERSION`.
- `consentStatus(row)` nach D1, `consentStatusText(status, confirmedAt)`.
- Tests: jeder Zustand und der Vorrang (abgelehnt und bestätigt zugleich → abgelehnt); v1 per SHA-256 über
  `JSON.stringify(CONSENT_TEXTS.v1)` festgeschrieben (der Test sagt im Namen: neuer Wortlaut = neue Version);
  Gegenprobe: ein Wort in v1 ändern → Test rot, zurück.

**T3 Actions** (`actions.ts` + Test gegen die Dev-Datenbank, `createTestSite`)
- D6. Tests: Zustimmen legt `requested` mit `consentVersion` „v1“ an; ohne Haken Feldfehler `agree`, keine Zeile;
  vierte SportpassID abgelehnt; fremde vergeben → Meldung; Widerruf nur eigene (fremde ID → Fehler, Zeile bleibt);
  Widerruf lässt Scheiben mit `ownerId` stehen; Bestätigen nur durch Admin (Schütze → Fehler), zweimal → „Schon
  entschieden.“; Ablehnen nach Bestätigen → `rejected`, nicht mehr in `GET /state`; Bestätigen einer `returned` (Zeile
  von Hand mit `returnedAt`) → `active`, `returnedAt` null.
- Mutationsprobe: in `revokeSportpass` die Bedingung `userId` entfernen → der Test „nur eigene“ wird rot.

**T4 Lesen** (`queries.ts`): D7; `site.ts` und `site-actions.ts` bereinigen (alte Tests dort auf die neuen Actions
umziehen). Test: `openConsents` liefert `requested` und `returned`, nicht `active`/`rejected`, ältere zuerst.

**T5 Zustand für die Brücke** (`bridges.test.ts`): Zustimmungen in allen vier Zuständen anlegen; in den Hashes nur die
bestätigte. `bridges.ts` und `ingest.ts` bleiben unverändert (filtern schon auf `confirmedAt`); der Test sichert es.

**T6 Profil** (`ConsentForm.tsx`, `ProfileScreen.tsx`, `profile/page.tsx`)
- D4. Seite reicht alle eigenen Zeilen durch (nicht mehr nur bestätigte). Hinweistext als Absätze, Checkbox mit
  `aria-invalid`/`aria-describedby` bei Feldfehler, Pending-Text „Zustimmen…“. Rückmeldung wie im Rest von Spiegel
  ohne Toasts: Fehler als `role="alert"`-Text am Abschnitt, Erfolg zeigt sich an der neuen Zeile (`router.refresh()`),
  `ConfirmDialog` wie in `SiteForms.tsx`.
  Markup-Test (`renderToStaticMarkup`): Status in Worten je Zustand, „Widerrufen“ nur bei `requested`/`active`/`returned`,
  der Text von v1 steht im Formular.

**T7 Admin** (`SportpassSection.tsx`, `OpenConsents.tsx`, Admin-Seiten)
- D5. Markup-Test: Knöpfe je Zustand; ohne offene der Satz.

**T8 Prüfung im Browser** (Dev-Server :3002, Demo-Konto über `seed:own --demo` und ein Admin): Schütze stimmt zu →
Admin sieht die Anfrage oben in „Konten“ → bestätigt → Profil „aktiv seit …“ → widerrufen → weg; Ablehnen → „abgelehnt“
→ Entfernen. Am Telefon (375 px) und am Desktop, keine Konsolenfehler. Testzeilen danach entfernen.
`pnpm --filter spiegel pruefen --start` grün (das Profil hat dort Prüfungen).

**T9 Doku**
- `spiegel-assignment`: Opt-in-Abschnitt auf den Ablauf D1/D4/D5 (Zustimmung im Profil mit Hinweistext v1, Admin
  bestätigt, Widerruf).
- `spiegel-privacy`: Widerruf → Scheiben bleiben, der Schütze löscht selbst; Admin trägt nichts mehr ein.
- `spiegel-open-questions`: „Was passiert beim Widerruf …“ und „Erste Scheibe bestätigen lassen?“ beantwortet
  (14. Oktober 2026, User; „Nicht meine“ bei der ersten → Grabstein, Zustimmung zurück an den Admin).
- `spiegel-roadmap`: SP-1.7 Status (a1 erledigt, a2 offen); bei SP-1.7 und SP-1.9 der Satz: **Nach dem ersten Deploy
  hat der QR-Weg Priorität eins** (SP-1.7 b mit den Aufträgen aus SP-1.5/SP-1.6, Scannen, PDF-Volume samt Backup; User,
  14. Oktober 2026).
- `spiegel-db-schema`: die neuen Spalten.
- `apps/spiegel/CLAUDE.md`: Bullet „Admin → Anlage und Brücken“ anpassen (SportpassIDs trägt der Schütze ein, Admin
  bestätigt), neuer Bullet „Zustimmung“ (Zustände, Text im Code, neue Version statt Änderung).
- `/sync-graph` (vault-lint).

## Verifikation

- `pnpm check` grün (alle fünf Gates, auch Go).
- Wegwerf-Postgres: Diff nach der neuen Init-Migration leer (T1.4).
- Tests aus T2–T7, Mutationsproben aus T2 und T3 belegt (rot, dann zurück).
- Browser wie T8; was die Daten nicht hergeben, steht im Bericht als „nicht belegt“.
- Nach dem Merge (User): `pnpm --filter spiegel exec prisma migrate reset --force`, dann `pnpm --filter spiegel
  seed:own`.
