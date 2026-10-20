# Plan: Spiegel — eine Scheibe per Link teilen

> PIV-Handoff-Artefakt. Branch `feat/spiegel-share-card`, Worktree `.claude/worktrees/spiegel-share-card` (vom User
> gewünscht, ADR-024). Task 1 (Schema + Migration) ist ein geschützter Pfad: Er läuft vor dem Autopilot in der
> Hauptsession; danach `/implement` autonom ab Task 2.

## Context (warum)

Ein Schütze will eine einzelne Scheibe zeigen können, etwa dem Trainer oder in einem Chat, ohne dass die andere Seite
ein Konto braucht. Heute ist jede Scheibe privat: `proxy.ts` verlangt eine Anmeldung, `cardWithShots` liest nur mit
`ownerId` ([[spiegel-privacy]]: „Privat ist Standard“). In [[spiegel-open-questions]] steht „Ergebnis per Link teilen?“
noch offen; dieser Plan beantwortet die Frage mit „ja, je Scheibe, nur auf ausdrücklichen Wunsch des Schützen“.

Anforderungen des Users:

1. Auf der Seite einer Scheibe einen Link zum Teilen erzeugen, der eine UUID enthält.
2. Jeder mit dem Link sieht genau diese eine Scheibe, ohne Anmeldung.
3. Alle Statistiken sind sichtbar (Scheibe, Serien, Schusstabelle, Analyse mit allen Reitern, Hilfe).
4. Keine Navigation, kein Löschen, kein Umstellen (Art, Wertung), sonst keine Interaktion mit Folgen.

## Entscheidungen (mit Empfehlung, im Plan zur Freigabe)

- **Ein Link je Scheibe, beendbar.** Die UUID steht als Spalte an der Scheibe (`Card.shareId`, `@db.Uuid`, eindeutig),
  dazu `Card.sharedAt`. „Teilen beenden“ setzt beides auf null; neu teilen erzeugt eine **neue** UUID, der alte Link
  bleibt tot. Kein Ablaufdatum.
- **UUID v4** aus `crypto.randomUUID()` (122 Bit Zufall). Nicht zu erraten; keine eigene Ratenbegrenzung für die Seite.
- **Adresse** `/share/<uuid>` (englische Pfade wie der Rest, [[spiegel-navigation]]).
- **Was der Link zeigt:** die Seite einer Scheibe ohne Rahmen der App (keine Leiste, keine Seitenleiste, keine Links),
  ohne Rückweg und Blättern, ohne die Kreise für Art und Wertung, ohne Löschen und ohne Teilen. Die Scheibe öffnet in
  der Wertung, die der Schütze für sie gewählt hat. Was nur die Ansicht im Browser ändert, bleibt: Ebenen der Scheibe,
  Ausschnitt, Serie wählen, Schuss wählen, Lineal, Reiter der Analyse, „Erklärungen“, das Blatt der Hilfe.
- **Keine Personendaten:** Kein Name, keine Sportpassnummer, kein Konto. `PageCard` enthält schon heute nichts davon
  (Disziplin, Liste, Datum, Schüsse); die Seite liest nur über `PAGE_CARD_SELECT`. Die interne Kennung der Scheibe
  (cuid) steht im Modell; sie öffnet ohne Anmeldung nichts.
- **Wann der Link nicht mehr geht** (Hinweisseite statt Scheibe, HTTP 404): Teilen beendet; Scheibe gelöscht
  (`deleteCard` beendet das Teilen in derselben Änderung, Wiederherstellen bringt den Link **nicht** zurück); Scheibe
  endgültig gelöscht; Disziplin ignoriert, Scheibe wartend oder Konto deaktiviert (geprüft beim Lesen).
- **Hinweistext der Zustimmung bleibt v2.** Er sagt „Deine Scheiben siehst nur du“. Teilen ist eine ausdrückliche
  Handlung des Schützen mit eigenem Dialog, der genau sagt, wer was sieht. Eine neue Version des Hinweistexts braucht
  es dafür nicht.
- **Suchmaschinen:** `robots: noindex, nofollow` und `referrer: no-referrer` auf der geteilten Seite.
- **Keine ADR berührt.** [[adr-029]] (keine Personendaten im Repo) und [[adr-031]] (Schichten, Übersichten ohne
  Schüsse) gelten unverändert; die geteilte Seite lädt Schüsse wie die Seite einer Scheibe.

## Texte (Textbuch: neu, zur Freigabe mit dem Plan)

Nach [[conventions]] §10 „So schreiben wir“. Stehen in `apps/spiegel/src/lib/admin/consequences.ts` (Dialoge) bzw.
in den Komponenten (Zustände).

**Dialog „Scheibe teilen?“** (`cardShare({ evening })`)

- about: „Du teilst die Scheibe vom {Abend um Uhrzeit}.“
- check: „Den Link bekommt nur, wem du ihn schickst. Wer ihn hat, kann ihn weitergeben.“
- happens: „Spiegel erstellt einen Link zu dieser einen Scheibe.“ · „Wer den Link öffnet, sieht die Scheibe mit allen
  Schüssen und Zahlen. Eine Anmeldung braucht es dafür nicht.“
- notHappening: „Dein Name und deine Sportpassnummer stehen nicht dabei.“ · „Deine anderen Scheiben bleiben privat.“ ·
  „Wer den Link öffnet, kann nichts ändern und nichts löschen.“
- undo: „Hier auf der Seite der Scheibe jederzeit „Teilen beenden“. Danach geht der Link nicht mehr.“
- Knopf: „Link erstellen“ (nicht destruktiv)

**Dialog „Teilen beenden?“** (`cardShareStop({ evening })`)

- about: „Die Scheibe vom {Abend um Uhrzeit} ist geteilt.“
- happens: „Der Link geht sofort nicht mehr. Wer ihn öffnet, sieht einen Hinweis statt der Scheibe.“
- notHappening: „Die Scheibe bleibt in Spiegel, wie sie ist.“
- undo: „Neu teilen geht jederzeit. Das gibt einen neuen Link. Der alte bleibt aus.“
- Knopf: „Teilen beenden“ (destruktiv)

**Dialog „Scheibe löschen?“** (`cardDelete({ evening, shared })`), nur wenn geteilt, zusätzlich in happens:
„Der geteilte Link geht nicht mehr. Auch nach dem Wiederherstellen bleibt er aus.“

**Abschnitt „Teilen“ auf der Seite einer Scheibe** (`ShareCard`)

- nicht geteilt: Knopf „Scheibe teilen“ (Symbol `Share2`)
- geteilt: Zeile „Geteilt seit {Datum}“, darunter der Link als Text (markierbar), Knöpfe „Link kopieren“ (`Copy`),
  „Senden…“ nur wenn der Browser `navigator.share` kann (`Send`), „Teilen beenden“ (`Unlink`)
- nach dem Kopieren leise: „Link kopiert“; Fehler: „Der Link ließ sich nicht erstellen.“ bzw. „Das Teilen ließ sich
  nicht beenden.“

**Geteilte Seite**

- Kopf (ohne Link): „Geteilte Scheibe · Spiegel“
- Hinweis, wenn der Link nicht geht (`not-found.tsx` des Segments): Titel „Diese Scheibe ist nicht mehr geteilt“, Text
  „Der Link geht nicht mehr. Das Teilen wurde beendet oder die Scheibe gelöscht. Wer die Scheibe zeigen will, schickt
  einen neuen Link.“

## Approach

1. **Daten:** zwei Spalten an `Card`, Migration `card_share` (nur anhängen). Keine eigene Tabelle: ein Link je Scheibe,
   Löschen der Scheibe nimmt ihn mit, kein Join beim Lesen.
2. **Lesen** (`src/lib/db/reads.ts`): `sharedCard(db, shareId)` liest über `PAGE_CARD_SELECT` mit
   `{ shareId, ...VISIBLE_CARD, owner: { isActive: true } }` → `toPageCard`. `cardShare(db, { cardId, ownerId })` liefert
   `{ shareId, sharedAtMs } | null` für die eigene Seite.
3. **Schreiben** (`src/lib/share-actions.ts`, `"use server"`, Muster von `trash-actions.ts`): `shareCard(cardId)` und
   `stopSharingCard(cardId)`, je unter `lockCard` in einer Transaktion, die Bedingung im `updateMany` selbst (§9). Kein
   `revalidatePath` (wie `setCardKind`: sonst scrollt Next zum Anker); der Abschnitt hält den Zustand aus dem Ergebnis.
   `deleteCard` setzt `shareId` und `sharedAt` mit auf null.
4. **Freigabe ohne Anmeldung:** `proxy.ts` nimmt `share/` aus dem Matcher (wie `login`). Die Seite liegt außerhalb von
   `(app)` unter `src/app/share/[shareId]/`, also ohne `requireSession` und ohne `AppShell`.
5. **Ansicht:** `CardScreen` bekommt statt `near`/`paging` ein `own: OwnCardControls | null` und einen `path`. Mit
   `own === null` (geteilt) fehlen Kontextleiste, Kreise für Art und Wertung, Teilen und Löschen, und die Adresse wird
   nicht fortgeschrieben (nur der Anker des Reiters). Eine Hülle `SharedShell` (Client) gibt Hilfe (`HelpProvider`,
   `HelpSheet`) ohne `AppFrame`.

## Files to change (Implement)

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/prisma/schema.prisma` | `Card.shareId String? @unique @db.Uuid`, `Card.sharedAt DateTime? @db.Timestamptz(3)` |
| `apps/spiegel/prisma/migrations/<ts>_card_share/migration.sql` | neu, aus `prisma migrate diff` |
| `apps/spiegel/src/lib/share.ts` | neu: `isShareId`, `sharePath` (rein, isomorph) |
| `apps/spiegel/src/lib/share.test.ts` | neu |
| `apps/spiegel/src/lib/db/reads.ts` | `sharedCard`, `cardShare` |
| `apps/spiegel/src/lib/db/reads-share.test.ts` | neu, gegen die Dev-Datenbank |
| `apps/spiegel/src/lib/share-actions.ts` | neu: `shareCard`, `stopSharingCard` |
| `apps/spiegel/src/lib/share-actions.test.ts` | neu, Muster `card-kind-actions.test.ts` |
| `apps/spiegel/src/lib/trash-actions.ts` | `deleteCard` beendet das Teilen |
| `apps/spiegel/src/lib/trash.test.ts` bzw. vorhandener Test von `deleteCard` | Fall „geteilt → gelöscht → wiederhergestellt: Link bleibt aus“ |
| `apps/spiegel/src/lib/admin/consequences.ts` (+ Test) | `cardShare`, `cardShareStop`, `cardDelete({ shared })` |
| `apps/spiegel/src/proxy.ts` | `share(?:/|$)` im Matcher frei |
| `apps/spiegel/src/lib/proxy-matcher.test.ts` | neu: Matcher lässt `/share/<uuid>` frei, sonst nichts Neues |
| `apps/spiegel/src/components/card/CardScreen.tsx` | `own`/`path` statt `near`/`paging`; geteilte Variante |
| `apps/spiegel/src/components/card/ShareCard.tsx` | neu: Abschnitt „Teilen“ |
| `apps/spiegel/src/components/card/DeleteCard.tsx` | `shared` an `cardDelete` durchreichen |
| `apps/spiegel/src/app/(app)/cards/[id]/page.tsx` | `cardShare` lesen, `own` bauen |
| `apps/spiegel/src/components/share/SharedShell.tsx` | neu: Hilfe ohne Rahmen, Kopfzeile |
| `apps/spiegel/src/app/share/[shareId]/page.tsx` | neu |
| `apps/spiegel/src/app/share/[shareId]/not-found.tsx` | neu |
| `apps/spiegel/src/components/card/ShareCard.test.tsx`, `SharedShell.test.tsx` | Markup-Tests (`renderToStaticMarkup`) |
| `packages/pruefen/src/browser.ts` | `newPage({ isolated: true })`: eigener Browser-Kontext ohne Cookies |
| `apps/spiegel/tools/pruefen.ts` | Abschnitt „Geteilte Scheibe“ |
| `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-privacy.md`, `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-open-questions.md`, `vault/spiegel/spiegel-roadmap.md`, `vault/architecture/architecture.md` | Doku |

## Required Docs (vor Implementierung lesen)

- `apps/spiegel/CLAUDE.md` (Schichten, Privat ist Standard, Kein Knopf ohne Folge, Tests gegen die Dev-Datenbank,
  Migrationen nur anhängen, Skriptprüfung)
- `vault/conventions.md` §2 (DecisionDialog), §3, §4 (Icons), §9 (Prüfen und Ändern in einer Transaktion,
  Markup-Tests), §10 (So schreiben wir)
- `vault/spiegel/spiegel-privacy.md`, `vault/spiegel/spiegel-navigation.md`
- Auto-Memory: `spiegel-dev-db-init-checksum` (Migration über `migrate diff` + `migrate deploy`),
  `worktree-env-links`, `node-version-in-bash`, `stop-gate-checks-main-checkout`, `demo-seed-restore-same-command`

## Tasks (/implement — je ein fokussierter Commit)

### 0. Worktree vorbereiten (Hauptsession, kein Commit)

```bash
cd .claude/worktrees/spiegel-share-card
for a in ringwerk treffsicher spiegel; do ln -sf ../../../../../apps/$a/.env apps/$a/.env; done
ln -sfn ../../../../../../apps/spiegel/tools/private apps/spiegel/tools/private
export PATH="$HOME/.nvm/versions/node/$(ls ~/.nvm/versions/node | grep '^v24' | tail -1)/bin:$PATH"
pnpm install --frozen-lockfile
```

### 1. Schema und Migration (geschützter Pfad, Hauptsession vor dem Autopilot)

`schema.prisma`, im Modell `Card` nach `deletedAt`:

```prisma
  // Link zum Teilen (`/share/<uuid>`), vom Schützen erzeugt; null: nicht geteilt. Neu teilen gibt eine neue UUID
  shareId           String?         @unique @db.Uuid
  sharedAt          DateTime?       @db.Timestamptz(3)
```

Migration ohne `migrate dev` (Prüfsumme der Init-Migration der Dev-Datenbank):

```bash
cd apps/spiegel
mkdir -p prisma/migrations/20261020120000_card_share
pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma \
  --shadow-database-url "$SHADOW_URL" --script > prisma/migrations/20261020120000_card_share/migration.sql
pnpm exec prisma migrate deploy && pnpm exec prisma generate
```

Erwartet im SQL: `ALTER TABLE "Card" ADD COLUMN "shareId" UUID, ADD COLUMN "sharedAt" TIMESTAMPTZ(3);` und
`CREATE UNIQUE INDEX "Card_shareId_key" ON "Card"("shareId");`. Ohne Shadow-DB alternativ `--from-schema` gegen den
Stand von `main` (`git show main:apps/spiegel/prisma/schema.prisma > /tmp/…`). Commit:
`feat(spiegel): add share link columns to cards`.

### 2. Reine Helfer `src/lib/share.ts` + Test

```ts
// Link zum Teilen einer Scheibe: Adresse und Prüfung der Kennung, isomorph (Seite, Proxy-Test, Hülle)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** eine Kennung aus der Adresse: UUID in Kleinbuchstaben, wie Postgres sie ausgibt */
export const isShareId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value)

export const sharePath = (shareId: string) => `/share/${shareId}`
```

Test: gültige UUID ja; Großbuchstaben, cuid, leer, 37 Zeichen, `../` nein. Commit `feat(spiegel): add share id helpers`.

### 3. Lesen: `sharedCard`, `cardShare` + Test gegen die Dev-Datenbank

In `reads.ts`:

```ts
/**
 * Geteilte Scheibe (`/share/<uuid>`): wie `cardWithShots`, aber über den Link statt über den Besitzer; null, wenn das
 * Teilen beendet ist, die Scheibe gelöscht ist, wartet, ihre Disziplin ignoriert ist oder das Konto aus ist
 */
export async function sharedCard(db: Db, shareId: string): Promise<PageCard | null> {
  const row = await db.card.findFirst({
    where: { shareId, ...VISIBLE_CARD, owner: { isActive: true } },
    select: PAGE_CARD_SELECT,
  })
  return row ? toPageCard(row) : null
}

/** der Link einer eigenen Scheibe; null, wenn sie nicht geteilt ist */
export async function cardShare(db: Db, query: { cardId: string; ownerId: string }) {
  const row = await db.card.findFirst({
    where: { id: query.cardId, ownerId: query.ownerId, shareId: { not: null } },
    select: { shareId: true, sharedAt: true },
  })
  return row?.shareId && row.sharedAt
    ? { shareId: row.shareId, sharedAtMs: row.sharedAt.getTime() }
    : null
}
```

`reads-share.test.ts` (eigene Anlage über `createTestSite`, Scheiben aus `generateSeason`): geteilte Scheibe kommt mit
Schüssen; null für unbekannte UUID, für gelöscht, wartend (`ownerPending`), ignorierte Disziplin, deaktiviertes Konto;
die Schlüssel des Ergebnisses sind genau die von `PageCard` (kein `ownerId`, `sportpassId`, `shareId`);
`cardShare` liefert nur dem Besitzer etwas. Commit `feat(spiegel): read shared cards by link`.

### 4. Actions `shareCard`, `stopSharingCard`; `deleteCard` beendet das Teilen

`src/lib/share-actions.ts`:

```ts
"use server"

import { randomUUID } from "node:crypto"

import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { lockCard } from "@/lib/db/purge"
import { VISIBLE_CARD } from "@/lib/db/visible"
import type { ActionResult } from "@/lib/types"

// Teilen einer eigenen Scheibe per Link: Prüfung und Änderung in einer Transaktion unter der Sperre der Zeile (§9).
// Kein `revalidatePath`: Danach scrollte Next zum Anker der Adresse; der Abschnitt hält den Zustand aus dem Ergebnis.

const MISSING = "Diese Scheibe gibt es nicht mehr."
const RETRY = "Das geht gerade nicht. Lade die Seite neu."

export interface Share { shareId: string; sharedAtMs: number }

/** teilt die eigene Scheibe; ist sie schon geteilt, bleibt ihr Link */
export async function shareCard(cardId: string): Promise<ActionResult<Share>> { … }

/** beendet das Teilen; der Link geht danach nicht mehr, neu teilen gibt einen neuen */
export async function stopSharingCard(cardId: string): Promise<ActionResult> { … }
```

- `shareCard`: `shooterId` → `isCardIdInput` → `$transaction`: `lockCard`; `findFirst({ id, ownerId, ...VISIBLE_CARD })`
  → sonst `MISSING`; vorhandene `shareId` zurückgeben; sonst `updateMany({ where: { id, ownerId, shareId: null,
  ...VISIBLE_CARD }, data: { shareId: randomUUID(), sharedAt: new Date() } })`, bei `count !== 1` `MISSING`. Fehler →
  „Der Link ließ sich nicht erstellen.“
- `stopSharingCard`: gleiche Prüfung ohne `VISIBLE_CARD`-Pflicht (auch eine gelöschte darf beendet werden),
  `updateMany({ where: { id, ownerId }, data: { shareId: null, sharedAt: null } })`; schon beendet ist Erfolg.
- `trash-actions.ts` `deleteCard`: `data: { deletedAt: new Date(), shareId: null, sharedAt: null }`.

`share-actions.test.ts` (Mocks wie `card-kind-actions.test.ts`): ohne Sitzung und mit `mustChangePassword` Fehler;
fremde, gelöschte, wartende und unbekannte Scheibe → `MISSING`, nichts geändert; zweimal teilen → dieselbe UUID;
beenden → `sharedCard` null; neu teilen → andere UUID; kein `revalidatePath`. Im Test von `deleteCard`: geteilt →
löschen → `shareId` null → wiederherstellen → weiter null. Commit `feat(spiegel): share and stop sharing a card`.

### 5. Texte in `consequences.ts` + Test

`cardShare({ evening })`, `cardShareStop({ evening })` wörtlich nach Abschnitt „Texte“; `cardDelete({ evening,
shared = false })` hängt den Satz zum Link an `happens`, wenn `shared`. Tests halten den Wortlaut wie die vorhandenen
und laufen durch `OLD_WORDS` (keine Semikolons). Commit `feat(spiegel): wording for sharing a card`.

### 6. Abschnitt „Teilen“ auf der Seite einer Scheibe

- `CardScreen.tsx`: Props `near`/`paging` ersetzt durch

  ```ts
  /** was nur der Besitzer hat: Rückweg und Blättern, Art und Wertung, Teilen, Löschen; null auf der geteilten Seite */
  own: { near: { prev: string | null; next: string | null } | null; paging: boolean; share: Share | null } | null
  /** die Adresse dieser Seite, für Anker und Fortschreiben (`/cards/<id>` bzw. `/share/<uuid>`) */
  path: string
  ```

  `ownPath` wird `path`. Mit `own === null`: keine `CardContextBar`, `actions` undefiniert (kein `KindToggle`, kein
  `ScoringToggle`), kein `ShareCard`, kein `DeleteCard`, der Effekt mit `nextCardAddress` läuft nicht (früh zurück).
  Hooks bleiben unbedingt aufgerufen.
- `ShareCard.tsx` (Client): `share` als Anfangszustand; „Scheibe teilen“ öffnet `DecisionDialog` mit `cardShare`,
  danach `shareCard`; geteilt: „Geteilt seit {formatDateOnly(new Date(sharedAtMs), timeZone)}“, Link als
  `${window.location.origin}${sharePath(id)}` (beim Hydrieren über `useSyncExternalStore` mit Server-Wert nur Pfad),
  „Link kopieren“ (`navigator.clipboard.writeText`, danach 2 s „Link kopiert“ mit `role="status"`), „Senden…“ nur mit
  `navigator.share`, „Teilen beenden“ mit `cardShareStop`. Knöpfe wie `DeleteCard` (rund, `h-10`, Symbole aus
  lucide: `Share2`, `Copy`, `Send`, `Unlink`). Fehler als `role="alert"`.
- `DeleteCard.tsx`: Prop `shared` → `cardDelete({ evening, shared })`.
- `cards/[id]/page.tsx`: `cardShare(db, { cardId: id, ownerId })`, `own={{ near, paging, share }}`,
  `path={`/cards/${encodeURIComponent(id)}`}`.
- `ShareCard.test.tsx`: Markup ungeteilt (Knopf „Scheibe teilen“), geteilt (Datum, Pfad `/share/<uuid>`, „Teilen
  beenden“).

Commit `feat(spiegel): share section on the card page`.

### 7. Geteilte Seite `/share/[shareId]`

- `proxy.ts` Matcher: `"/((?!login(?:/|$)|share(?:/|$)|api/auth(?:/|$)|api/ingest(?:/|$)|_next/|favicon.ico$|icon.svg$).*)"`,
  Kommentar ergänzt („eine geteilte Scheibe öffnet ohne Anmeldung, die Seite prüft den Link“).
  `proxy-matcher.test.ts`: `new RegExp("^" + source + "$")` aus `config.matcher[0]` (ohne Next) — `/share/<uuid>`,
  `/login` frei; `/`, `/cards/x`, `/shares`, `/sharex/1`, `/admin` nicht frei.
- `SharedShell.tsx` (Client): `HelpProvider` + `HelpSheet` wie in `AppShell`, Kopfzeile „Geteilte Scheibe · Spiegel“
  als Text (`text-sm text-muted-foreground`, kein Link), darunter `children`.
- `share/[shareId]/page.tsx` (Server):

  ```tsx
  export const metadata: Metadata = {
    title: "Geteilte Scheibe",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  }

  // Eine geteilte Scheibe: ohne Anmeldung, ohne Rahmen der App, nur Ansicht (`own={null}`)
  export default async function SharedCardPage({ params }: { params: Promise<{ shareId: string }> }) {
    const { shareId } = await params
    if (!isShareId(shareId)) notFound()
    const card = await sharedCard(db, shareId)
    if (!card?.targetId) notFound()
    const route = routeFromUrl(`/cards/${encodeURIComponent(card.id)}`, "", "")
    if (route.page !== "card") notFound()
    return (
      <SharedShell>
        <CardScreen card={card} route={route} own={null} path={sharePath(shareId)}
          context={{ timeZone: getDisplayTimeZone(), nowMs: Date.now(), named: [] }}
          display={await targetDisplay()} key={card.id} />
      </SharedShell>
    )
  }
  ```

- `share/[shareId]/not-found.tsx`: `PageHeader` (`design2/page-header`) in `Page` mit den Texten aus Abschnitt „Texte“, ohne Link.
- `SharedShell.test.tsx`: Markup ohne `<a`, ohne `<nav`.

Commit `feat(spiegel): public read-only page for a shared card`.

### 8. Skriptprüfung

- `packages/pruefen/src/browser.ts`: `newPage(options?: { isolated?: boolean })` — mit `isolated`
  `Target.createBrowserContext` und `browserContextId` an `Target.createTarget` (keine Cookies der angemeldeten Seite).
- `apps/spiegel/tools/pruefen.ts`, Abschnitt „Geteilte Scheibe“ (vor „Gemeinsame Prüfungen“): auf `href` „Scheibe
  teilen“ → Dialog bestätigen → Link lesen; in einer isolierten Seite öffnen: Status 200, kein `<a href>`, kein `nav`,
  keine Knöpfe „Scheibe löschen“, „Scheibe teilen“, kein Kreis für Art/Wertung (`[data-result-actions]` fehlt);
  Reiterwechsel der Analyse und Blatt der Hilfe gehen; Telefon ohne seitliches Scrollen; keine Skriptfehler. Danach
  „Teilen beenden“ → isolierte Seite zeigt den Hinweis (404). Am Ende ist die Scheibe wieder ungeteilt (Prüfung
  hinterlässt nichts).

Commit `test(spiegel): check the shared card in the browser`.

### 9. Doku

- `apps/spiegel/CLAUDE.md`: Aufbau (`src/app/share/[shareId]` ohne Anmeldung), Regel „Teilen per Link“ (Spalten,
  Lesen über `sharedCard` mit `VISIBLE_CARD` und aktivem Konto, Löschen beendet das Teilen, `own={null}`).
- `vault/spiegel/spiegel-privacy.md`: Grundsatz „Teilen nur auf ausdrücklichen Wunsch, je Scheibe, beendbar, ohne
  Name“; Rollen-Tabelle Zeile „Gast ohne Konto“: „eine geteilte Scheibe über ihren Link“ / „nichts ändern“.
- `vault/spiegel/spiegel-open-questions.md`: „Ergebnis per Link teilen?“ → ja, je Scheibe ([[spiegel-privacy]]).
- `vault/spiegel/spiegel-navigation.md`: Route `/share/<uuid>`, was die geteilte Seite zeigt und was nicht.
- `vault/spiegel/spiegel-roadmap.md`: Status unter SP-1.8 (Scheiben-Liste und Seite einer Scheibe) „Teilen per Link“ erledigt.
- `vault/architecture/architecture.md`: Routen von Spiegel um `/share/[id]` (öffentlich, Link).
- `/sync-graph`. Commit `docs(spiegel): sharing a card by link`.

## Test steps (nach Implement, committeter Stand)

```bash
cd .claude/worktrees/spiegel-share-card
pnpm check
pnpm --filter spiegel seed:own --demo && pnpm --filter spiegel pruefen --start --alle; pnpm --filter spiegel seed:own
```

(Gate im Worktree selbst laufen lassen: Das Stop-Gate prüft den Haupt-Checkout.)

## Validate (`reports/2026-10-20-spiegel-share-card.md`)

- Im Browser-Pane angemeldet: Scheibe teilen, Link kopieren; in einem zweiten Tab ohne Sitzung (privates Fenster bzw.
  isolierte Seite) öffnen: Scheibe, Serien, Tabelle, alle Reiter der Analyse, Hilfe; keine Leiste, kein Link, kein
  Löschen, keine Kreise. Telefonbreite 375 px.
- Teilen beenden → Hinweis. Neu teilen → neue UUID, alte geht nicht. Löschen → Link aus, Wiederherstellen → bleibt aus.
- `curl -sI http://localhost:3002/share/<uuid>` ohne Cookie → 200, kein Redirect auf `/login`;
  `/share/kein-uuid` → 404; `/cards/<id>` ohne Cookie → Redirect auf `/login` (unverändert).
- HTML der geteilten Seite enthält keinen Namen, keine E-Mail, keine Sportpassnummer des Demo-Kontos
  (`curl … | grep -c` gegen die Werte aus `tools/demo-account.ts`).

## Verification (Erfolgskriterium)

- Alle vier Anforderungen oben belegt (Skriptprüfung + Validierungsbericht).
- `pnpm check` grün im Worktree; `pruefen --start` ohne FAIL.
- Migration nur angehängt; `…_init` unverändert.
- Keine Brücke nötig: Die Änderung betrifft nur Spiegel (Server), nicht `spiegel-bridge`.

## Zurückgestellt (nicht dieser Durchlauf)

- Mehrere Links je Scheibe, Ablaufdatum, Zähler „wie oft geöffnet“.
- Vorschaubild für Messenger (Open Graph mit gerenderter Scheibe).
- Teilen eines Zeitraums oder Abends.
- Eine Liste aller geteilten Scheiben im Profil.
