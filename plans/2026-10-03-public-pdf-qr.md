# QR-Code + öffentliche URL auf intern heruntergeladenen PDFs

**Datum:** 2026-10-03 · **Branch:** `feat/public-pdf-qr` · **App:** ringwerk

## 1. Context (warum)

Ausdrucke von Spielplan, Playoffs, Rangliste und Saison-Tabelle hängen im Vereinsheim. Wer dort das
**aktuelle** Ergebnis nachlesen will, soll das öffentliche PDF (`/api/public/c/<slug>/pdf`) per
QR-Code direkt öffnen können. Bei passwortgeschützten Wettbewerben soll der Wettbewerb optional
festlegen können, dass der QR-Code die Passwortabfrage **umgeht**, über ein geheimes Token im Link.

Anforderungen (User, 2026-10-02/03):

- **R1:** Nur die **intern** heruntergeladenen Haupt-PDFs eines veröffentlichten Wettbewerbs
  (`/api/competitions/[id]/pdf/{schedule,playoffs,ranking,standings}`) tragen URL + QR-Code.
- **R2:** Die Domain kommt aus dem Request (`x-forwarded-host`/`host` hinter Caddy).
- **R3:** Am Wettbewerb einstellbar: Der QR-Code enthält ein Token (UUID), das die Passwortabfrage
  umgeht. Ohne Token gilt weiter Basic-Auth.
- **R4:** Die **öffentlich** ausgelieferten PDFs enthalten **nie** QR-Code oder Token.
- **R5:** Der Render-Cache des öffentlichen PDFs (`unstable_cache`, 24h, Key
  `competitionId`+`phaseTag`) bleibt korrekt.

Nicht im Scope: A/B-Balance im Best-of-Spielplan (eigenes Thema), Starterliste und
Teilnehmerliste (keine öffentlichen Gegenstücke).

## 2. Entscheidungen

**E1: Ein Feld `publicAccessToken String? @unique`.** Der Bypass ist aktiv genau dann, wenn das
Feld gesetzt ist. Es gibt bewusst kein zusätzliches Boolean. Das Token wird **im Klartext**
gespeichert, nicht gehasht, weil der interne PDF-Export es in den QR-Code schreiben muss. Es ist
eine widerrufbare Zugangsberechtigung (Capability) und kein Passwort. Es geht **nie** an den
Client: `CompetitionDetail` bekommt nur `hasPublicAccessToken: boolean`, genau wie
`hasPublicPassword`. Erzeugt wird es mit `crypto.randomUUID()`.

**E2: Token als Query-Parameter `?k=<uuid>`.** Die Route prüft das so: Ist ein Passwort gesetzt
**und** `k` gleich `competition.publicAccessToken` (Vergleich über `crypto.timingSafeEqual`, vorher
Längen-Check), entfällt die Basic-Auth. Ein falsches oder fehlendes Token führt in den normalen
401-Pfad, ohne eigene Fehlermeldung, damit die Antwort nichts über das Token verrät. Das Token gilt
nur für den Wettbewerb, auf den `resolveSlug` auflöst. Caddy schreibt keine Access-Logs (keine
`log`-Direktive im `Caddyfile`), also landet das Token in keinem Log.

**E3: Der QR-Code erscheint nur, wenn der Slug auf *diesen* Wettbewerb auflöst.** Der interne
Export prüft `resolveSlug(slug)?.id === competition.id`. Hintergrund: Ein abgeschlossener
Wettbewerb kann seinen Slug an einen neuen, aktiven Wettbewerb verloren haben. Sein QR-Code würde
dann auf ein fremdes PDF zeigen.

**E4: Domain aus dem Request, mit Validierung.** Der Host kommt aus dem ersten Wert von
`x-forwarded-host`, sonst aus `host`. Das Protokoll kommt aus dem ersten Wert von
`x-forwarded-proto`, sonst aus `req.nextUrl.protocol`. Der Host muss
`/^[a-z0-9.-]+(:\d{1,5})?$/i` erfüllen. Andernfalls gibt es keinen QR-Code statt einer kaputten
URL. Caddy setzt `X-Forwarded-Host`/`-Proto` bei `reverse_proxy` standardmäßig.

**E5: Gedruckter Text = URL ohne Token, QR-Code = URL mit Token (falls aktiv).** Eine UUID
abzutippen ist unrealistisch. Der Text dient zur Orientierung.

**E6: Platzierung rechts im Seitenkopf, nur auf Seite 1.** Rechts im Kopf steht dann eine Spalte:
QR-Code 72 pt (≈ 25 mm), darunter die URL (7 pt), darunter wie bisher „Erstellt: …“. Bei
`PlayoffsPdf` erscheint der Code nur auf der Bracket-Seite. Die Platzierung ist eine Annahme (der
User hat sie nicht explizit gewählt) und lässt sich an **einer** Stelle (`HeaderMeta`) ändern.

**E7: Die öffentliche Route bleibt QR-frei, strukturell und getestet.** Ihre Builder übergeben kein
`publicLink`. Ein Test prüft die Props aller vier öffentlichen Render-Pfade. Damit ist R5 trivial
erfüllt: Der gecachte Inhalt hängt weder vom Host noch vom Token ab, Cache-Key und Tag bleiben
unverändert.

**E8: Formular mit Drei-Wege-Semantik (Konvention §9).** Die neuen Checkboxen stehen im bedingt
gerenderten `isPublic`-Block. Ein Hidden-Marker `publicAccessFields=1` im selben Block
unterscheidet „Block nicht gerendert“ (Spalte nicht anfassen) von „Checkbox abgewählt“ (Token
löschen).

**E9: QR-Code als Vektorpfad.** `qrcode` (1.5.4) liefert über `QRCode.create(text, {
errorCorrectionLevel: "M" })` nur die Modul-Matrix. Daraus wird **ein** `<Path>` in react-pdfs
`<Svg>`. Das bleibt scharf im Druck, es entsteht kein PNG und kein Canvas. Die Dependency ist
app-spezifisch und kommt deshalb als literale Version in `apps/ringwerk/package.json`, nicht in den
Catalog (siehe `pnpm-workspace.yaml`).

## 3. Approach / Dateien

| Datei | Änderung |
| --- | --- |
| `apps/ringwerk/prisma/schema.prisma` + neue Migration | `publicAccessToken String? @unique` |
| `apps/ringwerk/package.json`, `pnpm-lock.yaml` | `qrcode` 1.5.4, dev `@types/qrcode` 1.5.6 |
| `apps/ringwerk/src/lib/competitions/publicAccess.ts` (neu) | rein: `isValidAccessToken`, `resolveAccessTokenUpdate` |
| `apps/ringwerk/src/lib/competitions/publicPdfLink.ts` (neu) | rein: `requestOrigin`, `buildPublicPdfLink` + server: `getPublicPdfLink` |
| `apps/ringwerk/src/lib/pdf/qrMatrix.ts` (neu) | rein: `qrPathData(text)` |
| `apps/ringwerk/src/lib/pdf/HeaderMeta.tsx` (neu) | rechte Kopfspalte (QR + URL + „Erstellt“) |
| `apps/ringwerk/src/lib/pdf/{SchedulePdf,BestOfSchedulePdf,PlayoffsPdf,EventRankingPdf,SeasonStandingsPdf}.tsx` | optionales Prop `publicLink`, `HeaderMeta` statt `headerDate`-Text |
| `apps/ringwerk/src/app/api/competitions/[id]/pdf/{schedule,playoffs,ranking,standings}/route.ts` | `getPublicPdfLink(req, id)` → Prop |
| `apps/ringwerk/src/app/api/public/c/[slug]/pdf/route.ts` | Token-Bypass vor der Basic-Auth |
| `apps/ringwerk/src/lib/competitions/{types,listQueries}.ts` | `hasPublicAccessToken` |
| `apps/ringwerk/src/lib/competitions/actions/{baseSchema,create,update}.ts` | Felder parsen, Token setzen/rotieren/löschen |
| `apps/ringwerk/src/components/app/competitions/competition-form/{PublishSection.tsx,useCompetitionFormState.ts}` | Checkboxen + Marker |
| `vault/apps/ringwerk/pdf-public-urls.md` | Abschnitt QR-Code/Token |

## Required Docs

- `vault/conventions.md`: §6 (Formatierung über `@vereinsheim/lib/format`), §9 (Drei-Wege-Semantik
  bei ausgeblendeten Feldern, Markup ohne jsdom testbar), §8 (fünf Gates).
- `vault/apps/ringwerk/pdf-public-urls.md` + `vault/incidents/public-pdf-cache-tag-orphaning.md`:
  Cache-Identität der öffentlichen Route, nicht anfassen.
- `apps/ringwerk/CLAUDE.md`.

## 4. Tasks

### Task 1: Schema + Migration (**Hauptsession, vor `/implement`**)

Der Autopilot-Guard (ADR-023) sperrt `prisma/`. Darum wird dieser Task **vor** dem Start von
`/implement` in der Hauptsession über `/migrate` erledigt und committet.

`schema.prisma`, im Modell `Competition` direkt unter `publicPasswordHash`:

```prisma
  // Geheimes Zugangs-Token für den QR-Code auf intern exportierten PDFs: umgeht die
  // Passwortabfrage. null = kein Bypass. Klartext, weil der Export es in den QR-Code schreibt;
  // geht nie an den Client (nur hasPublicAccessToken).
  publicAccessToken  String? @unique
```

Danach `/migrate` mit dem Namen `public_access_token` ausführen.
Commit: `feat(ringwerk): add publicAccessToken to competitions`.

### Task 2: Dependency `qrcode`

```bash
pnpm --filter ringwerk add qrcode@1.5.4
```

```bash
pnpm --filter ringwerk add -D @types/qrcode@1.5.6
```

Danach prüfen, dass `apps/ringwerk/package.json` exakte Versionen ohne `^` enthält (Repo-Konvention:
exakt gepinnt), und gegebenenfalls von Hand korrigieren plus `pnpm install`.
Commit: `build(ringwerk): add qrcode for PDF QR codes`.

### Task 3: QR-Matrix → Pfad (`lib/pdf/qrMatrix.ts`)

```ts
import QRCode from "qrcode"

/** Ruhezone um den Code in Modulen (Spec: mind. 4). */
export const QR_QUIET_ZONE = 4

/**
 * Wandelt Text in die Pfaddaten eines QR-Codes: ein Quadrat je dunklem Modul, verschoben um die
 * Ruhezone. `size` ist die Kantenlänge inklusive Ruhezone, für die viewBox.
 */
export function qrPathData(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" })
  const parts: string[] = []
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) {
        parts.push(`M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`)
      }
    }
  }
  return { size: modules.size + 2 * QR_QUIET_ZONE, d: parts.join("") }
}
```

Test `qrMatrix.test.ts`:
- `size` ist `modules.size + 8`, und `modules.size` ist eine gültige QR-Größe (`(size - 8 - 21) % 4 === 0`).
- `d` enthält genau so viele `M`-Kommandos wie dunkle Module (Gegenrechnung über `QRCode.create`).
- Kein Kommando liegt in der Ruhezone (alle Koordinaten ≥ 4 und < size − 4).
- Längerer Text (URL mit `?k=<uuid>`) ergibt einen größeren oder gleich großen Code.

Commit: `feat(ringwerk): render QR codes as vector path data`.

### Task 4: Link-Bau (`lib/competitions/publicPdfLink.ts`)

```ts
// Server-only: getPublicPdfLink imports the Prisma client. Do NOT import from Client Components.
// The pure helpers (requestOrigin, buildPublicPdfLink) and the PublicPdfLink type are safe to share.
import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { resolveSlug } from "./publicSlugQueries"

export type PublicPdfLink = {
  /** Gedruckter Text — nie mit Token. */
  displayUrl: string
  /** Inhalt des QR-Codes — mit `?k=<token>`, wenn der Passwort-Bypass aktiv ist. */
  qrUrl: string
}

const HOST_REGEX = /^[a-z0-9.-]+(:\d{1,5})?$/i

/** Origin des Requests hinter Caddy; null bei unplausiblem Host. */
export function requestOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim()
  if (!host || !HOST_REGEX.test(host)) return null
  const rawProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? fallbackProtocol
  const proto = rawProto.replace(/:$/, "")
  if (proto !== "http" && proto !== "https") return null
  return `${proto}://${host}`
}

export function buildPublicPdfLink(input: {
  origin: string
  slug: string
  /** Nur übergeben, wenn ein Passwort gesetzt ist UND der Bypass aktiv ist. */
  accessToken: string | null
}): PublicPdfLink {
  const displayUrl = `${input.origin}/api/public/c/${input.slug}/pdf`
  const qrUrl = input.accessToken
    ? `${displayUrl}?k=${encodeURIComponent(input.accessToken)}`
    : displayUrl
  return { displayUrl, qrUrl }
}

/**
 * Link für den QR-Code eines intern exportierten PDFs — oder null, wenn der Wettbewerb nicht
 * veröffentlicht ist oder sein Slug auf einen anderen Wettbewerb auflöst (E3).
 */
export async function getPublicPdfLink(
  req: NextRequest,
  competitionId: string
): Promise<PublicPdfLink | null> {
  const row = await db.competition.findUnique({
    where: { id: competitionId },
    select: { isPublic: true, publicSlug: true, publicPasswordHash: true, publicAccessToken: true },
  })
  if (!row?.isPublic || !row.publicSlug) return null
  const holder = await resolveSlug(row.publicSlug)
  if (holder?.id !== competitionId) return null
  const origin = requestOrigin(req.headers, req.nextUrl.protocol)
  if (!origin) return null
  return buildPublicPdfLink({
    origin,
    slug: row.publicSlug,
    accessToken: row.publicPasswordHash ? row.publicAccessToken : null,
  })
}
```

(Kein `import "server-only"`: `src/lib` nutzt das nirgends, der Kopfkommentar folgt
`publicSlugQueries.ts`.)

Test `publicPdfLink.test.ts` (nur die reinen Funktionen):
- `requestOrigin`: `x-forwarded-host` hat Vorrang vor `host`; die erste Komma-Komponente wird
  genommen; `x-forwarded-proto: https` hat Vorrang vor dem Fallback `http:`; ein Fallback mit
  Doppelpunkt (`"http:"`) wird normalisiert; Host `evil.com/x` → null; Proto `javascript` → null;
  `localhost:3000` → `http://localhost:3000`.
- `buildPublicPdfLink`: ohne Token sind `displayUrl === qrUrl`; mit Token endet `qrUrl` auf
  `?k=<token>`, und `displayUrl` enthält das Token **nicht**.

Commit: `feat(ringwerk): build the public PDF link from the request origin`.

### Task 5: Kopfspalte `HeaderMeta` (`lib/pdf/HeaderMeta.tsx`)

```tsx
import type { ReactElement } from "react"
import { Path, Svg, Text, View } from "@react-pdf/renderer"
import type { PublicPdfLink } from "@/lib/competitions/publicPdfLink"
import { qrPathData } from "./qrMatrix"
import { PDF_COLORS, styles } from "./styles"
import { formatDateOnly } from "@vereinsheim/lib/format"

const QR_SIZE_PT = 72

/** Rechte Spalte im Seitenkopf: optional QR-Code + öffentliche URL, darunter das Erstelldatum. */
export function HeaderMeta({
  generatedAt,
  displayTimeZone,
  publicLink,
}: {
  generatedAt: Date
  displayTimeZone: string
  publicLink?: PublicPdfLink | null
}): ReactElement {
  const created = (
    <Text style={styles.headerDate}>Erstellt: {formatDateOnly(generatedAt, displayTimeZone)}</Text>
  )
  if (!publicLink) return created
  const qr = qrPathData(publicLink.qrUrl)
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Svg width={QR_SIZE_PT} height={QR_SIZE_PT} viewBox={`0 0 ${qr.size} ${qr.size}`}>
        <Path d={qr.d} fill={PDF_COLORS.dark} />
      </Svg>
      <Text style={{ fontSize: 7, color: PDF_COLORS.muted, marginTop: 2, marginBottom: 2 }}>
        {publicLink.displayUrl}
      </Text>
      {created}
    </View>
  )
}
```

`import type { PublicPdfLink }` ist ein reiner Typ-Import und zieht kein `db` in die PDF-Module.
Falls tsc/eslint das trotzdem moniert: `PublicPdfLink` nach `lib/competitions/types.ts` verschieben
und von beiden Seiten importieren.

Commit: `feat(ringwerk): add a header column with QR code to PDFs`.

### Task 6: Die fünf PDF-Komponenten

In jeder Datei:
1. Props-Interface um `/** Nur interne Exporte (nie die öffentliche Route, R4). */ publicLink?: PublicPdfLink | null` ergänzen.
2. Den `<Text style={styles.headerDate}>Erstellt: …</Text>` im Kopf durch
   `<HeaderMeta generatedAt={generatedAt} displayTimeZone={displayTimeZone} publicLink={publicLink} />`
   ersetzen. Bei den lokalen `PdfHeader`-Funktionen (`SchedulePdf`, `BestOfSchedulePdf`,
   `PlayoffsPdf`) bekommt `PdfHeader` dafür das Prop `publicLink`.
3. `PlayoffsPdf`: nur der `PdfHeader` der Bracket-Seite (Seite 1) bekommt `publicLink`, Seite 2
   bekommt es nicht.
4. Wird `formatDateOnly` in einer Datei danach nicht mehr verwendet: den Import entfernen.

Tests (in `SchedulePdf.test.tsx` und `BestOfSchedulePdf.test.tsx`, per `extractPdfText`):
- Mit `publicLink` steht `displayUrl` im Text, und das Token aus `qrUrl` kommt **nicht** im Text vor.
- Ohne `publicLink` ist kein `/api/public/c/` im Text.

Commit: `feat(ringwerk): show the public link in the PDF header`.

### Task 7: Interne Export-Routen

In `schedule`, `playoffs`, `ranking`, `standings`:
- Parameter `_req` → `req`.
- Neben den bestehenden Abfragen (im selben `Promise.all`, falls vorhanden):
  `getPublicPdfLink(req, id)`.
- `publicLink` an das `createElement` übergeben.

Commit: `feat(ringwerk): put the public QR code on internally exported PDFs`.

### Task 8: Token-Bypass in der öffentlichen Route

In `app/api/public/c/[slug]/pdf/route.ts` den Passwort-Block so erweitern:

```ts
  if (competition.publicPasswordHash) {
    const viaToken = hasValidAccessToken(
      req.nextUrl.searchParams.get("k"),
      competition.publicAccessToken
    )
    if (!viaToken) {
      // … bestehende Basic-Auth-Prüfung unverändert …
    }
  }
```

`hasValidAccessToken` liegt rein in `lib/competitions/publicAccess.ts`:

```ts
import { timingSafeEqual } from "node:crypto"

/** Prüft das QR-Token aus `?k=` gegen das gespeicherte Token, ohne Timing-Leck. */
export function hasValidAccessToken(provided: string | null, stored: string | null): boolean {
  if (!provided || !stored) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(stored, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}
```

Tests:
- `publicAccess.test.ts`: null/leer → false; gleich → true; gleiche Länge, anderer Wert → false;
  andere Länge → false (kein Throw).
- `route.test.ts`, neuer `describe("public PDF route — QR access token")`. `callRoute` bekommt eine
  Option `query`, damit `?k=` gesetzt werden kann. Fälle: richtiges Token + Passwort → 200 ohne
  `bcrypt.compare`; falsches Token → 401; Token gesetzt, aber `publicAccessToken: null` am
  Wettbewerb → 401; richtiges Token **und** falsches Basic-Passwort → 200 (Token gewinnt).
- `route.test.ts`, R4/E7: Für alle vier Phasen (`ranking`, `standings`, `schedule`, `playoffs`)
  ist im an `renderToBufferMock` übergebenen Element `props.publicLink` `undefined`.
- Die bestehenden Cache-Tests bleiben unverändert grün (R5).

Commit: `feat(ringwerk): let the QR access token bypass the public PDF password`.

### Task 9: Persistenz (Schema, Actions, Detail-Typ)

`baseSchema.ts`, neben `removePublicPassword`:

```ts
    // Hidden-Marker: der isPublic-Block wurde gerendert (Drei-Wege-Semantik, Konvention §9)
    publicAccessFields: z.string().nullable().optional().transform((v) => v === "1"),
    // „QR-Code öffnet ohne Passwort“
    publicQrBypass: z.string().nullable().optional().transform((v) => v === "true" || v === "on"),
    // „Neuen Zugangscode erzeugen“ — macht bisherige Ausdrucke ungültig
    rotatePublicAccessToken: z.string().nullable().optional().transform((v) => v === "true" || v === "on"),
```

In `publicAccess.ts` zusätzlich:

```ts
import { randomUUID } from "node:crypto"

/**
 * Drei-Wege-Update für `publicAccessToken`:
 * Block nicht gerendert → undefined (Spalte nicht anfassen); Bypass aus → null;
 * Bypass an → bestehendes Token behalten, außer es fehlt oder soll rotiert werden.
 */
export function resolveAccessTokenUpdate(input: {
  fieldsPresent: boolean
  bypass: boolean
  rotate: boolean
  existing: string | null
}): string | null | undefined {
  if (!input.fieldsPresent) return undefined
  if (!input.bypass) return null
  if (input.existing && !input.rotate) return undefined
  return randomUUID()
}
```

- `update.ts`: `publicAccessToken: true` im `select`; die drei Felder in `safeParse`;
  `publicAccessToken: resolveAccessTokenUpdate({ fieldsPresent, bypass, rotate, existing })` im
  `update.data`. Rotieren oder Ausschalten ändert den PDF-Inhalt **nicht**, also wird
  `revalidatePublicPdf` nicht zusätzlich aufgerufen.
- `create.ts`: dieselben Felder parsen; `publicAccessToken:
  resolveAccessTokenUpdate({ ..., existing: null }) ?? null`.
- `types.ts`: `CompetitionDetail.hasPublicAccessToken: boolean` (Kommentar wie bei
  `hasPublicPassword`: Token nie zum Client).
- `listQueries.ts` `getCompetitionById`: `publicAccessToken: true` selektieren, destrukturieren
  und als `hasPublicAccessToken: publicAccessToken != null` zurückgeben. Gegenprobe:
  `grep -rn "publicAccessToken" apps/ringwerk/src/components` → nur `hasPublicAccessToken`.

Tests:
- `publicAccess.test.ts`: alle vier Zweige von `resolveAccessTokenUpdate`; ein neues Token ist
  eine UUID v4 (Regex); bei Rotation unterscheidet es sich vom bestehenden.
- `actions.test.ts`: Update mit Marker + Bypass bei bestehendem Token → `data.publicAccessToken`
  `undefined`; Marker ohne Bypass → `null`; **ohne** Marker (isPublic-Block nicht gerendert) →
  `undefined`, auch wenn ein Token existiert; Rotation → neue UUID ≠ alte. Create mit Bypass → UUID.

Commit: `feat(ringwerk): persist the QR access token setting`.

### Task 10: Formular

`useCompetitionFormState.ts`: States `publicQrBypass` (Init `competition?.hasPublicAccessToken ??
false`) und `rotatePublicAccessToken` (Init `false`) plus `hasExistingAccessToken`. Alles wie bei
`removePublicPassword` zurückgeben.

`PublishSection.tsx`, im `{isPublic && (…)}`-Block nach dem Passwort-Abschnitt:

```tsx
          <input type="hidden" name="publicAccessFields" value="1" />
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="publicQrBypass"
                name="publicQrBypass"
                checked={publicQrBypass}
                onCheckedChange={(v) => setPublicQrBypass(v === true)}
                disabled={isPending}
              />
              <div className="space-y-1">
                <Label htmlFor="publicQrBypass">QR-Code auf Ausdrucken öffnet ohne Passwort</Label>
                <p className="text-xs text-muted-foreground">
                  Intern heruntergeladene PDFs tragen einen QR-Code zum öffentlichen PDF. Ist diese
                  Option aktiv, enthält er einen geheimen Zugangscode. Wer den Ausdruck sieht, kommt
                  ohne Passwort hinein. Wirkt nur, wenn ein Passwort gesetzt ist.
                </p>
              </div>
            </div>
            {publicQrBypass && hasExistingAccessToken && (
              <div className="flex items-center gap-2 pl-7">
                <Checkbox
                  id="rotatePublicAccessToken"
                  name="rotatePublicAccessToken"
                  checked={rotatePublicAccessToken}
                  onCheckedChange={(v) => setRotatePublicAccessToken(v === true)}
                  disabled={isPending}
                />
                <Label htmlFor="rotatePublicAccessToken" className="text-sm font-normal">
                  Neuen Zugangscode erzeugen (bisherige Ausdrucke öffnen dann wieder mit Passwort)
                </Label>
              </div>
            )}
          </div>
```

Die URL-Zeile `URL: /api/public/c/…` bleibt unverändert.

Commit: `feat(ringwerk): add the QR password bypass to the publish settings`.

### Task 11: Doku

`vault/apps/ringwerk/pdf-public-urls.md`: neuer Abschnitt „QR-Code auf internen Exporten“ mit
R1/R4, E1–E3 und E5. Dazu `keywords:` ergänzen um `QR-Code, Aushang, Zugangscode,
publicAccessToken, Passwort-Bypass`. Danach `node .claude/hooks/vault-lint.mjs` bzw. `/sync-graph`.

Commit: `docs(vault): document the QR code on exported PDFs`.

## 5. Verification

1. `pnpm check`: alle fünf Gates grün (lint, format:check, test, tsc, `next build`; Server Actions
   wurden geändert, `next build` ist Pflicht).
2. Dev-Server starten. Laut Memory haben die Dev-Daten eine Live-Kopie. Der User meldet sich selbst
   an, der Agent gibt keine Zugangsdaten ein. Datenlage vorab abgleichen: einen veröffentlichten
   Liga-Wettbewerb **mit** und einen **ohne** Passwort wählen. Fehlt einer, über das Formular
   anlegen bzw. umstellen.
3. Interner Spielplan-Export:
   - Wettbewerb ohne Veröffentlichung → kein QR-Code.
   - Veröffentlicht ohne Passwort → QR-Code, Text-URL `http://localhost:<port>/api/public/c/<slug>/pdf`.
   - Mit Passwort + Bypass → der QR-Code enthält `?k=`. Den QR-Inhalt dekodieren (z.B.
     `zbarimg` auf eine gerenderte Seite, wenn vorhanden; sonst die Unit-Tests aus Task 6 als
     Beleg nennen).
4. Öffentliche URL mit `?k=<token>` → 200 ohne Passwortabfrage. Ohne `k` oder mit falschem `k` → 401.
5. Öffentliches PDF (alle Phasen, die die Daten hergeben) → kein QR-Code, kein `/api/public/c/` im
   Text.
6. „Neuen Zugangscode erzeugen“ speichern → altes `k` → 401, neuer Export → neues `k` → 200.
7. Bypass ausschalten → altes `k` → 401, neuer Export → QR-Code ohne `k`.
8. Was die Daten nicht hergeben (z.B. Playoffs gestartet), steht im Validierungsbericht als
   **„nicht belegt“**, mit dem Test, der den Pfad abdeckt.
