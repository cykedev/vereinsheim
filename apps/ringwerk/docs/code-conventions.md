# Code Conventions – Ringwerk

Verbindlich gleichrangig mit `docs/technical.md`.

## Index

- [Benennungsregeln](#benennungsregeln)
- [Enums (vollständige Liste)](#enums)
- [TypeScript-Regeln](#typescript-regeln)
- [Zod v4](#zod-v4)
- [React 19 useActionState](#react-19-useactionstate)
- [Dateistruktur einer Komponente](#dateistruktur-einer-komponente)
- [Server Actions](#server-actions)
- [Datenbankzugriffe](#datenbankzugriffe)
- [Kommentare](#kommentare)
- [Fehlerbehandlung](#fehlerbehandlung)
- [Testing](#testing)

---

## Benennungsregeln

| Was                    | Konvention                         | Beispiel                 |
| ---------------------- | ---------------------------------- | ------------------------ |
| Dateien (Komponenten)  | PascalCase, englisch               | `MatchResult.tsx`        |
| Dateien (Logik/Utils)  | camelCase                          | `calculateRingteiler.ts` |
| React-Komponenten      | PascalCase, englisch               | `function MatchResult()` |
| Funktionen & Variablen | camelCase                          | `const bestTeiler`       |
| Konstanten (global)    | SCREAMING_SNAKE_CASE               | `const MAX_SHOTS = 10`   |
| Prisma-Modelle         | PascalCase                         | `model League`           |
| Enum-Werte             | SCREAMING_SNAKE_CASE, **englisch** | `WHOLE`, `WITHDRAWN`     |
| TypeScript-Interfaces  | PascalCase, kein `I`-Präfix        | `interface MatchData`    |
| Routen / URL-Segmente  | lowercase-kebab-case, englisch     | `/leagues/new`           |

---

## Enums

Alle Enum-Werte sind **englisch** und **SCREAMING_SNAKE_CASE**.

### Wertungsart (Disziplin)

```
WHOLE      – Ganzringe
DECIMAL    – Zehntelringe
```

### Liga-Status

```
ACTIVE
COMPLETED
ARCHIVED
```

### Teilnehmer-Status (in einer Liga)

```
ACTIVE
WITHDRAWN   – zurückgezogen
```

### Paarung-Status (Gruppenphase)

```
PENDING     – noch nicht ausgetragen
COMPLETED   – Ergebnis eingetragen
BYE         – Freilos (kampfloser Sieg bei ungerader Teilnehmerzahl)
WALKOVER    – Kampflos-Sieg (Gegner unangekündigt nicht erschienen)
```

Hinweis: Playoff-Einzel-Duelle haben kein eigenes Status-Enum, sondern `isCompleted: Boolean`.

### Runde (Gruppenphase)

```
FIRST_LEG   – Hinrunde
SECOND_LEG  – Rückrunde
```

### Playoff-Runde

```
QUARTER_FINAL
SEMI_FINAL
FINAL
```

### Wettbewerbstyp (NEU)

```
LEAGUE     – Liga mit Spielplan, Tabelle, Playoffs
EVENT      – Einmaliges Event (Kranzlschiessen)
SEASON     – Langzeit-Wettbewerb (Jahrespreisschiessen)
```

### Wertungsmodus (NEU)

```
RINGTEILER       – MaxRinge - Ringe + (Teiler * Faktor); niedrigster gewinnt
RINGS            – Gesamtringe ganzzahlig; hoechster gewinnt
RINGS_DECIMAL    – Gesamtringe Zehntelwertung; hoechster gewinnt
TEILER           – Teiler * Faktor; niedrigster gewinnt
DECIMAL_REST     – Nachkommastelle summiert; hoechster gewinnt
TARGET_ABSOLUTE  – Abweichung vom Zielwert; geringste gewinnt
TARGET_UNDER     – ≤ Zielwert bevorzugt, dann Abweichung
TARGET_OVER      – >= Zielwert bevorzugt, dann Abweichung
```

### Zielwert-Typ (NEU, nur bei TARGET-Modi)

```
TEILER          – Zielwert bezieht sich auf korrigierten Teiler
RINGS           – Zielwert bezieht sich auf Ringe (ganzzahlig)
RINGS_DECIMAL   – Zielwert bezieht sich auf Ringe (Zehntelwertung)
```

### Wettbewerb-Status (ersetzt Liga-Status)

```
DRAFT       – in Vorbereitung
ACTIVE
COMPLETED
ARCHIVED
```

### Nutzer-Rolle

```
ADMIN      – Vollzugriff inkl. Nutzerverwaltung und Force-Delete
MANAGER    – Wettbewerbe + Ergebnisse + Teilnehmer verwalten; kein Zugriff auf /admin/
USER       – Read-only (Ergebnisse, Tabellen einsehen)
```

### Ergebnis-Importquelle

```
MANUAL
URL
PDF
```

---

## Shared Types (`src/lib/types.ts`)

### ActionResult

Einzige erlaubte Rückgabestruktur für alle Server Actions:

```typescript
// src/lib/types.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string | Record<string, string[] | undefined> }
```

**Verwendung:**

```typescript
// Allgemeiner Fehler
return { error: "Nicht angemeldet" }

// Validierungsfehler (Zod fieldErrors)
return { error: parsed.error.flatten().fieldErrors }

// Erfolg ohne Daten
return { success: true }

// Erfolg mit Daten
return { success: true, data: result }

// Auswerten im Client
if ("error" in result) {
  // Fehlerbehandlung
}
```

**Kein `throw`** aus Server Actions – immer strukturierte Rückgabe.

---

## TypeScript-Regeln

- **Kein `any`** – lieber `unknown` mit expliziter Prüfung
- **Keine komplexen Generics** – keine Conditional Types, keine Mapped Types
- **Explizite Rückgabetypen** bei allen Funktionen ausserhalb von Komponenten:

```typescript
// RICHTIG
async function getLeague(id: string): Promise<League | null> { ... }

// FALSCH
async function getLeague(id: string) { ... }
```

- **Prisma-Typen direkt nutzen** aus `@/generated/prisma/client` – nicht neu definieren

---

## Zod v4

Zod v4 hat breaking changes gegenüber v3:

```typescript
// RICHTIG (v4)
z.number({ message: "Muss eine Zahl sein" })

// FALSCH (v3-Syntax, funktioniert nicht mehr)
z.number({ invalid_type_error: "Muss eine Zahl sein" })
```

`z.enum()` erwartet `as const`:

```typescript
z.enum(["WHOLE", "DECIMAL"] as const)
```

---

## React 19 useActionState

Server Actions für `useActionState` brauchen zwingend `prevState` als ersten Parameter:

```typescript
// RICHTIG
export async function createLeague(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult>

// FALSCH – funktioniert nicht mit useActionState
export async function createLeague(formData: FormData): Promise<ActionResult>
```

---

## Dateistruktur einer Komponente

```typescript
// 1. Imports (externe Pakete zuerst, dann interne)
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createMatch } from "@/lib/matches/actions"

// 2. Typdefinitionen (nur was diese Datei braucht)
interface Props {
  leagueId: string
}

// 3. Komponente
export function MatchForm({ leagueId }: Props) {
  // 3a. Hooks
  // 3b. Event-Handler / lokale Funktionen
  // 3c. JSX
}
```

---

## Server Actions

Jede Server Action liegt in `actions.ts` im zugehörigen Feature-Ordner.
Aufbau immer: **Auth → Validierung → DB**

```typescript
// src/lib/matches/actions.ts
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"

const CreateMatchResultSchema = z.object({
  matchId: z.string().min(1, "Paarung ist erforderlich"),
  totalRings: z.number({ message: "Gesamtringe erforderlich" }),
  bestTeiler: z.number({ message: "Bester Teiler erforderlich" }),
})

export async function createMatchResult(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  // Schritt 1: Auth – ohne gültige Session kein DB-Zugriff
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }

  // Schritt 2: Validierung
  const parsed = CreateMatchResultSchema.safeParse({
    matchId: formData.get("matchId"),
    totalRings: Number(formData.get("totalRings")),
    bestTeiler: Number(formData.get("bestTeiler")),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Schritt 3: DB – immer mit userId filtern
  const result = await db.matchResult.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return { data: result }
}
```

---

## Datenbankzugriffe

- **Kein userId-Filter auf Fachdaten** — alle Wettbewerbs-, Teilnehmer- und Disziplindaten sind vereinsweit sichtbar; Zugangskontrolle erfolgt via Rolle (ADMIN/USER), nicht via userId
- **Kein direkter Prisma-Aufruf in Komponenten** – nur in `lib/*/` oder Server Actions
- **Keine rohen SQL-Queries** ausser für komplexe Statistiken, dann mit Kommentar

```typescript
// RICHTIG — vereinsweite Daten, gefiltert nach fachlichem Kontext
const series = await db.series.findMany({
  where: { competitionId },
  orderBy: { createdAt: "desc" },
})

// FALSCH — userId-Filter auf Vereinsdaten
const series = await db.series.findMany({
  where: { userId: session.user.id },
})
```

---

## Kommentare

Kommentare erklären **Warum**, nicht Was.

```typescript
// RICHTIG – erklärt die Absicht
// Niedrigerer Ringteiler gewinnt: MaxRinge - Ringe + Teiler
// Ein Schütze näher an der Mitte (kleinerer Teiler) erhält einen kleineren Wert
const ringteiler = maxRings - totalRings + bestTeiler

// FALSCH – beschreibt nur was der Code zeigt
// Berechnet Ringteiler
const ringteiler = maxRings - totalRings + bestTeiler
```

**Kommentare sind Pflicht bei:**

- Auth-Checks und `userId`-Filtern
- Nicht-offensichtlicher Geschäftslogik (Ringteiler-Berechnung, Rückzug-Logik, Playoff-Seeding)
- Workarounds oder bewussten Vereinfachungen (`// TODO: ...` mit Begründung)
- Jeder Funktion in `lib/` die nicht trivial ist (JSDoc):

```typescript
/**
 * Berechnet den Ringteiler einer Serie.
 * Formel: MaxRinge − Gesamtringe + bester Teiler
 * Niedrigerer Wert = besseres Ergebnis.
 */
function calculateRingteiler(totalRings: number, bestTeiler: number, maxRings: number): number { ... }
```

---

## Fehlerbehandlung

- **Kein `throw` aus Server Actions** – strukturierte Rückgaben
- **Keine leeren catch-Blöcke** – immer loggen und/oder weitergeben
- **Nutzer-Feedback** bei jeder Aktion (Erfolg oder konkreter Fehler)

```typescript
// RICHTIG
export async function withdrawParticipant(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await db.leagueParticipant.update({ ... })
    return { success: true }
  } catch (error) {
    // Fehler loggen, aber keinen Stack-Trace an den Nutzer geben
    console.error("Fehler beim Rückzug:", error)
    return { error: "Rückzug konnte nicht gespeichert werden." }
  }
}

// FALSCH
try { ... } catch (e) {}
```

---

## Testing

### Framework

- **Vitest** – Testdateien neben dem zu testenden Code: `calculateRingteiler.test.ts` neben `calculateRingteiler.ts`

### Was wird getestet (Pflicht)

1. **Berechnungslogik** – jede Funktion die Werte ausrechnet:
   - Ringteiler-Berechnung
   - Tabellenberechnung (Punkte, direkter Vergleich, bestes Ergebnis)
   - Playoff-Seeding und Bracket-Paarungen
   - Validierung von Schusswerten (min/max je nach Disziplin)

2. **Geschäftsregeln mit Sonderfällen**:
   - Rückzug: alle Ergebnisse werden gestrichen, Tabelle neu berechnet
   - Freilos bei ungerader Teilnehmerzahl
   - Archivierte Disziplin / Liga nicht in Auswahllisten

3. **Zugangskontrolle** (wo testbar):
   - Funktion gibt `null` zurück wenn `userId` nicht passt

4. **Server Action Orchestrierung**:
   - Auth-Guards, Fehlerpfade, erwartete Fehlermeldungen

### Was wird nicht getestet

- React-Komponenten auf reiner Presentational-Ebene
- Next.js Routing und Middleware
- Volle Prisma-Integrationspfade ohne dedizierte Test-DB

### Teststruktur (Arrange–Act–Assert)

```typescript
describe("calculateRingteiler", () => {
  it("berechnet Ringteiler korrekt für Ganzring-Disziplin", () => {
    // Arrange
    const totalRings = 88
    const bestTeiler = 25.7
    const maxRings = 100
    // Act
    const result = calculateRingteiler(totalRings, bestTeiler, maxRings)
    // Assert
    expect(result).toBe(37.7)
  })

  it("niedrigerer Ringteiler gewinnt", () => {
    expect(calculateRingteiler(96, 3.7, 100)).toBeLessThan(calculateRingteiler(96, 4.2, 100))
  })
})
```

### Testabdeckung

- Kein Prozentziel – Tests sollen sinnvoll sein, nicht vollständig
- Faustregel: jede Funktion in `lib/` mit Berechnung oder Entscheidungslogik bekommt Tests
- Tests müssen **vor dem Commit grün sein**

---

## Datum & Zeitzone

**Regel:** `toLocaleDateString()` ohne explizite Zeitzone ist verboten. Im Docker-Container läuft der Server in UTC — ohne Zeitzone-Angabe würden Daten in der Anzeige um eine Stunde verschoben sein.

**Korrekt: `formatDateOnly` aus `src/lib/dateTime.ts` verwenden**

```typescript
import { getDisplayTimeZone, formatDateOnly } from "@vereinsheim/lib/dateTime"

// In einer Server Component (einmalig laden):
const tz = getDisplayTimeZone()

// Datum formatieren:
formatDateOnly(league.firstLegDeadline, tz) // → "31.12.2026"

// Null-safe:
function formatDate(date: Date | null, tz: string): string {
  if (!date) return "—"
  return formatDateOnly(date, tz)
}
```

**Verboten:**

```typescript
// FALSCH — nutzt Server-Zeitzone (UTC in Docker)
date.toLocaleDateString("de-CH")

// FALSCH — auch ohne Locale
date.toLocaleDateString()
```

**`dateTime.ts` ist `server-only`** – kein Import in Client Components. Datum-Formatierung für den Client muss als String von der Server Component übergeben werden.

---

## Häufige Fallstricke

### Prisma 7: Client-Import-Pfad

```typescript
// RICHTIG (Prisma 7 — generierter Client)
import { PrismaClient } from "@/generated/prisma/client"

// FALSCH (Prisma < 7)
import { PrismaClient } from "@prisma/client"
```

### Prisma 7: Decimal-Felder erfordern `.toNumber()` für Arithmetik

```typescript
// RICHTIG
const ringteilerNum = result.ringteiler.toNumber()
const diff = ringteilerA.toNumber() - ringteilerB.toNumber()

// FALSCH — Decimal ist kein primitiver Typ
const diff = result.ringteiler - other.ringteiler // TypeError
```

### Root Layout: `export const dynamic = "force-dynamic"`

Ohne diesen Export versucht Next.js das Root-Layout statisch zu prerendern — schlägt fehl weil die DB im Build nicht verfügbar ist.

```typescript
// PFLICHT in src/app/layout.tsx
export const dynamic = "force-dynamic"
```

### Next.js 16: `proxy.ts` statt `middleware.ts`

In Next.js 16 heisst die Middleware-Konventionsdatei `src/proxy.ts` (nicht `src/middleware.ts`).
Route-Handler bleiben `route.ts` — das ist eine andere Konvention.

### Server Action ohne `prevState` schlägt fehl mit `useActionState`

```typescript
// RICHTIG — useActionState erwartet prevState als ersten Parameter
export async function createLeague(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult>

// FALSCH — funktioniert nicht mit useActionState
export async function createLeague(formData: FormData): Promise<ActionResult>
```

---

## Aus Lernlog übernommen

<!-- Zuletzt konsolidiert: 2026-06-18 -->

### Prisma-Queries (ergänzt)

- **Filter by active status in ranking queries**: When querying participants for rankings or series aggregations, always filter by `status: "ACTIVE"` to exclude withdrawn participants. Stale entries corrupt ranking results silently.

### Migration & Datenbankschema

- **Idempotente Migrations-SQL**: Immer `DO $$ BEGIN CREATE TYPE ...; EXCEPTION WHEN duplicate_object THEN null; END $$;` + `IF NOT EXISTS` für alle DDL-Statements schreiben. Verhindert Failed-Migration-States bei Teilanwendungen oder Wiederholungen.
- **Enum-Typ-Änderung in drei Schritten**: (1) `ALTER TABLE ... ALTER COLUMN ... DROP DEFAULT`, (2) `ALTER TYPE ... ADD VALUE` / `SET DATA TYPE`, (3) `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT`. Bestehende Defaults blockieren `ALTER TYPE`.
- **Manuelle Migrationen mit Future-Timestamp anlegen**: Timestamp > aktuell wählen (z.B. `+1 Tag`), damit nach anschliessendem `prisma migrate dev` die Anwendungsreihenfolge konsistent bleibt.
- **Unique Indexes umbenennen mit `ALTER INDEX`**: Prisma erzeugt Unique-Constraints als Indexes (`CREATE UNIQUE INDEX`). Umbenennen mit `ALTER INDEX ... RENAME TO`, nie mit `ALTER TABLE ... RENAME CONSTRAINT`.
- **Migrationen NIE nachträglich editieren**: Bereits angewendete Migration → Drift-Error bei erneutem `migrate dev`. Stattdessen neue Migration anlegen.
- **`npx prisma generate` nach jeder Migration**: `prisma migrate dev` führt `prisma generate` NICHT automatisch aus. Vor Typecheck oder Build immer manuell aufrufen.
- **Partielle Unique-Indizes für nullable FK-Felder**: Wenn ein nullable FK die Eindeutigkeitsbedingung kontrolliert, partielle Indizes statt globaler `@@unique`-Constraints verwenden (`WHERE col IS NULL` vs. `WHERE col IS NOT NULL`). Globale Unique-Indexes behandeln NULLs als distinct und erlauben dadurch Duplikate.
- **Partial Unique Indexes als separate Migration**: Prisma kann Partial Unique Indexes (mit `WHERE`-Bedingung) nicht im Schema ausdrücken. Nach `prisma migrate dev` eine zweite Migration mit Future-Timestamp anlegen und das `CREATE UNIQUE INDEX ... WHERE ...` SQL manuell hineinschreiben — nicht versuchen, es im Schema zu modellieren.
- **NULLs backfillen beim Erweitern eines Unique-Index um eine nullable Spalte**: SQL behandelt NULLs als distinct — das Erweitern eines Unique-Index um eine neue nullable Spalte verliert die Eindeutigkeit für bestehende Zeilen still. Bestehende NULLs auf einen Nicht-NULL-Sentinel backfillen UND den Schreiber den Sentinel immer setzen lassen.

### Dependency-Management

- **ESLint + framework config compatibility**: When upgrading ESLint major versions, verify that framework config packages (e.g. `eslint-config-next`) bundle compatible plugin versions. Upgrade both together or not at all.
- **Audit unused dependencies before upgrades**: Before upgrading dependencies, verify they are actually imported in the codebase. `npm outdated` won't flag unused packages — use grep to confirm usage.
- **`npm update` only changes the lock file**: `npm update` resolves newer versions within existing semver ranges and writes to `package-lock.json` only. It does not modify `package.json` — this is correct behavior, not a bug.

### Prisma-Queries

- **Nested-Select: exakten Relationsnamen aus schema.prisma ablesen**: Der Feldname auf dem Model (nicht der Typ) ist der korrekte Select-Key. `leagueParticipants` ≠ `LeagueParticipant[]`.
- **`onDelete: SetNull` nur auf nullable Felder**: Nur `String?` mit `onDelete: SetNull` kombinieren. Auf `String` (non-nullable) kommt FK-Constraint-Verletzung trotzdem.
- **Field-Rename: Nested Selects in verwandten Queries prüfen**: Beim Umbenennen nicht nur direkte Nutzung durchsuchen — ein Feld kann in vielen Kontexten genested sein (League → Participant, Matchup → Participant, etc.).
- **Test-Mocks nach Prisma-Renames aktualisieren**: Auch `count`-Mocks und FormData-Mocks mit alten Feldnamen aktualisieren — nicht nur Production-Code.
- **Aggregates (`_count`, `_sum`) in den Haupt-Query**: Nicht separat fetchen. Aggregates im Select kosten minimal, sparen aber einen DB Round-Trip.
- **`upsert` Pattern für Startup-Daten**: `where` mit deterministischem Schlüssel, `create` mit vollständigen Feldern, `update` nur mit änderbaren Feldern — idempotent ausführbar.
- **Prisma-Relation umbenennen: alle select/include-Queries aktualisieren**: Application-Interface-Felder können sich unterscheiden — nur der Prisma-Query-Key muss korrekt sein.
- **Neue Relationsfelder vor Core-Logic definieren**: Schema-Felder anlegen und migrieren, bevor Queries + Actions implementiert werden. Umgekehrte Reihenfolge zwingt zu manuellen Migrations-Workarounds.
- **`db push` nur für schnelle Exploration**: Nie für Dev-Persistenz. Wenn Drift auftritt: `prisma migrate reset --force`, dann `migrate dev` neu aufsetzen.
- **`$transaction` nur bei mehreren atomaren Operationen**: Einfache Einzellöschungen/-updates nie in `$transaction` wrappen — erhöht Komplexität ohne Nutzen.
- **FK-Feldnamen vor Bottom-up-Lösch-Transaktionen aus schema.prisma verifizieren**: Nie raten — die exakten FK-Feldnamen im Schema ablesen. Z.B. `Matchup.homeParticipantId`/`awayParticipantId` (nicht `homeId`/`awayId`), `PlayoffMatch.participantAId`/`participantBId`.

### Typen & Props

- **Zod-Teilmengen mit `z.enum()` statt `z.nativeEnum()`**: Wenn nur eine Teilmenge eines Enums gültig ist, `z.enum(SUBSET as const)` verwenden. `z.nativeEnum()` akzeptiert immer alle Werte und lässt ungültige Eingaben durch.
- **Prop-Typ nicht weiter als nötig fassen**: Wenn ein Cast wie `as keyof typeof MAP` nötig wird, ist der Prop-Typ zu weit gefasst (z.B. `string` statt `ScoringMode`). Den Typ im Props-Interface einschränken, dann entfällt der Cast.
- **Rolle umwidmen = Prop-Namen mitändern**: Wenn eine Variable semantisch umgewidmet wird (z.B. `isAdmin` bedeutet neu "ADMIN oder MANAGER"), alle Prop-Namen und Interfaces durchsuchen und umbenennen. Sonst bleibt irreführende Benennung im Komponentenbaum.
- **Duplikate vor dem Zusammenführen Wert-für-Wert vergleichen**: Gleiche Map-Keys bedeuten nicht gleiche Werte. Zwei semantische Kontexte (z.B. Form-Label vs. Spaltenkopf) rechtfertigen separate Maps, auch wenn die Keys identisch sind.

### Zod & FormData

- **Optionale FormData-Felder**: `z.string().nullable().optional()` verwenden — `FormData.get()` liefert `null` für fehlende Felder.
- **Zod: `.transform()` statt `.pipe()` für optionale Zahlen**: `.pipe()` nach `.transform()` kann Typ-Kollisionen verursachen.
- **Zod-Verarbeitungsreihenfolge**: `z.preprocess()` (Sentinel → null) → `.enum()` → `.nullable()` → `.transform()`. `preprocess` läuft vor Validierung, `transform` danach.
- **shadcn Select Sentinel-Wert**: `<SelectItem value="none">` + `.preprocess((v) => (v === "none" || !v ? null : v), z.enum([...]).nullable())`. Nie `value=""` — verursacht Runtime-Error.
- **Disabled Form-Controls submitten nicht**: Eine disabled (Radix-)Select sendet keinen Wert, ein Schema-Pflichtfeld scheitert dann an der Validierung. Muss ein Pflichtfeld sperrbar sein: `name` von der disabled Select entfernen und ein separates `<input type="hidden" name=… value={state} />` spiegeln (die Action ignoriert den Wert bei Sperre ohnehin).

### TypeScript & React

- **Typen nie aus `"use server"`-Dateien re-exportieren**: Verursacht Turbopack Build-Error. Typen in eigene `types.ts` auslagern, direkt von dort importieren.
- **Server-Actions mit Rückgabewert generisch typisieren**: `ActionResult<{ id: string }>` statt implizit `void`, wenn das Frontend Daten für Redirect/State-Update braucht.
- **Nullable-Feld-Änderung: Props-Cascade prüfen**: Bei Required → Nullable (`String` → `String?`): alle `types.ts` und alle Komponenten-Props die diesen Typ konsumieren aktualisieren.
- **Dialog auto-close mit `useEffect`**: `useEffect(() => { if (state?.success) setOpen(false) }, [state])` — nie im render body oder mit `useRef`-Guard.
- **Variablen ausserhalb `$transaction`-Callback deklarieren**: Variablen, die in der Transaktion UND danach gebraucht werden, mit `let` ausserhalb deklarieren, innerhalb zuweisen, ausserhalb verwenden (z.B. für Audit-Logs).
- **Komponenten nie inside render definieren**: ESLint `react-hooks/static-components`. Komponente ausserhalb verschieben, State als Props durchreichen.
- **HTML date input: ISO-Format für `defaultValue`**: `date.toISOString().slice(0, 10)`. `formatDateOnly()` ist für Display, nie für Form-`defaultValue`.
- **Prisma `@default` gilt nur für neue Datensätze**: Bei bestehenden Zeilen keine Defaults rückwirkend gesetzt. Migrations-Strategie vorher klären: nullable + Backfill-Query vs. non-nullable mit Migration-`data`-Block.
- **Client-sichere Pure-Helper nie mit DB-Funktionen in einer Datei**: Importiert eine Client Component einen Pure-Helper aus einer Datei, die auch DB-Code (`pg`/Prisma) exportiert, zieht der Prod-Bundle `dns`/`fs`/`net`/`tls` und der Build bricht. Splitten in `<feature>.ts` (pure) + `<feature>Queries.ts` (DB). Nur `next build` fängt das, nicht `tsc`/Lint.

### Next.js & Caching

- **`revalidateTag` braucht zweites Argument**: In Next.js 16 ist die einstellige Form `revalidateTag(tag)` deprecated und erzeugt Runtime-Warnungen. Immer `revalidateTag(tag, "max")` schreiben.
- **Nur JSON-serialisierbare Werte aus `unstable_cache`**: `unstable_cache` serialisiert via JSON — ein Buffer round-trippt als `{type:"Buffer",data:[…]}` und ist beim nächsten Read korrupt. Binärdaten als Base64 cachen und beim Lesen decoden.
- **Cache-Tag in JEDER schreibenden Action invalidieren**: Bei tag-basiertem Caching den Tag in allen Actions revalidieren, die die zugrunde liegenden Daten schreiben — nicht nur dort, wo der Tag „logisch zuhause" ist — sonst werden öffentliche/abgeleitete Daten stale. Ein zentraler Invalidierungs-Helper hält die Streuung lesbar.

### Server Actions

- **Alle benötigten Felder in einem select konsolidieren**: Wenn eine Server-Action mit einem DB-Fetch beginnt, alle später benötigten Felder in diesem einen `select` zusammenfassen. Niemals einen zweiten Fetch nach dem ersten try/catch nachschieben — das umgeht die Fehlerbehandlung und kostet einen unnötigen Round-Trip.
- **Eine Refresh-Quelle pro Route nach einer Server-Action**: Für „Server-Action → UI-Update" entweder `revalidatePath` ODER `router.refresh()` nutzen — nie beides auf derselben Route (sie konkurrieren und doppeln das Re-Render → Button hängt, erst ein zweiter Trigger flusht). `router.refresh()` AUSSERHALB einer Transition aufrufen (schlichtes `useState`-Lade-Flag statt `useTransition`), damit der auslösende Button nicht bis zum Ende des Refreshs disabled bleibt.

### Tooling

- **Reviewer-Aussagen mit echtem Lint verifizieren**: Behauptet ein Code-Reviewer (Mensch oder Agent), eine ESLint-Regel existiere nicht oder verhalte sich anders, immer mit echtem `/check`-Lauf gegenprüfen, bevor Code geändert wird. Reviewer-Urteile sind kein Ersatz für die echte Tool-Ausgabe.
- **Prettier nach neuen Dateien**: Nach jeder neuen Datei lokal `npx prettier --write <datei>` ausführen, bevor CI-Check läuft.
- **`<fieldset disabled>` für Form-Sektionen**: Deaktiviert alle enthaltenen Inputs, Labels und Buttons gleichzeitig — statt einzelne Inputs manuell zu disablen.

### Formatierung & Lokalisierung

- **Dezimaltrenner in `.toFixed()`-Ausgaben**: Jeder `.toFixed()`-Aufruf der benutzer-sichtbaren Text produziert muss `.replace(".", ",")` nachschalten (de-CH Locale). Gilt auch für abgeleitete Scores, Durchschnitte und PDF-Exporte — nicht nur für Primärwerte wie Ringe und Teiler.
- **Vollständigkeit beim Einführen von Formatierungshelfer**: Beim Umstellen auf neue Formatierungsfunktionen das gesamte Codebase nach Rohdaten-Anzeige durchsuchen (`.toFixed()`, direkte Zahl-Interpolation). Server-Komponenten, List-Items und PDF-Renderer werden leicht übersehen.
- **Datenmigration bei Code-Fix**: Wenn ein Persistenz-Bug gefixt wird, immer prüfen ob historische Datensätze im alten (falschen) Format gespeichert wurden. Ein Code-Fix allein reicht nicht — ggf. Backfill-Query oder Migration notwendig.
- **Rollen-Einführungs-Checkliste**: Beim Hinzufügen oder Ändern einer Nutzerrolle explizit alle Page-Dateien auf hardcodierte Role-Checks durchsuchen (z.B. `grep 'role !== "ADMIN"' src/app/`). Actions und Navigation-Guards reichen nicht — direkter Page-Guard ist eine separate Sicherheitsebene.
- **PDF-Routes mit demselben Role-Check absichern wie die zugehörige Page**: Neue PDF-/Export-Routes für sensitive Daten dürfen sich nicht auf einen reinen Session-Check verlassen. Immer denselben Authorization-Helper (z.B. `canManage()`) wie die UI-Page anwenden, sonst entsteht PII-Exposure über die Export-URL.
- **Prisma Decimal: `.toNumber()` auch für Client-Props**: `Decimal`-Felder sind nicht JSON-serialisierbar. Beim Übergeben von Prisma-Resultaten an Client Components (oder als Props durch die Server/Client-Boundary) immer `.toNumber()` in der Query-Mapping-Funktion aufrufen — nie roh weitergeben. Sonst gibt es einen Serialisierungsfehler zur Laufzeit.
- **Prettier auch für `.claude/` Markdown**: Plan-, Spec- und Lessons-Files unter `.claude/` werden von Prettier mitformatiert. Nach dem Erstellen oder Bearbeiten solcher Files immer `npx prettier --write <pfad>` laufen lassen, bevor committed wird — sonst schlägt `npm run format:check` im `/check`-Gate fehl.
- **PDF-Render-Tests: `extractPdfText`-Helper erforderlich**: Beim Testen von `@react-pdf/renderer`-Output immer einen dedizierten Helper schreiben, der `inflateSync` auf komprimierte Content-Streams anwendet und einen TJ-Hex-Regex nutzt, um lesbaren Text zurückzugewinnen. Rohe String-Checks auf den Buffer funktionieren nicht, da Content-Streams FlateDecode-komprimiert und Texte hex-kodiert sind.
- **DB-Feldnamenkollisionen vor neuen Feldern prüfen**: Vor dem Einführen eines neuen Schema-Felds oder Props prüfen, ob ein bestehendes Feld auf demselben Model denselben oder semantisch überlappenden Namen hat. Eindeutigen Namen wählen (z.B. `nr` statt `startNumber`), um Verwechslung mit persistierten Anwendungsdaten zu vermeiden.
- **Dokumentierte Domänen-Wertungsregeln zentral kodieren**: Eine in den Docs beschriebene Berechnungsregel (z.B. "Korrekturfaktor nur bei gemischter Disziplin") in genau einer reinen Helper-Funktion kodieren, durch die alle Persistenz- und Anzeige-Pfade ziehen. Nie je Aufrufer reimplementieren — sonst greift die Regel an manchen Stellen und an anderen nicht. Bei mehreren Auflösungsquellen (z.B. feste Competition-Disziplin vs. per-Teilnehmer) den Kontext aus der maßgeblichen Quelle nehmen (hier: `Competition.disciplineId`).
- **Invarianten am Code verifizieren, nicht aus Prosa-Docs ableiten**: Bevor man sich auf ein vermeintliches Constraint verlässt (z.B. "Saison ist immer gemischt"), die erzwingende Stelle prüfen — Zod-Schema, Action, DB-Constraint. `features.md`/`data-model.md` beschreiben Konvention und Soll, nicht garantierte Invarianten.
