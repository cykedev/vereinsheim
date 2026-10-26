# Plan: Kasten „Diese Scheibe“ auf der Seite einer Scheibe

> PIV-Handoff-Artefakt. Branch `feat/card-actions-box`, im aktuellen Tree (kein Worktree, sofern der User nichts anderes
> festlegt, ADR-024). Nur Spiegel. Kein Schema, keine Migration, keine Server Action ändert sich. **Brücke: kein Update
> nötig.** Ein Release von Spiegel auf den VPS ist nötig, wenn es live soll.

## Context (warum)

Am Ende der Seite einer Scheibe stehen „Disziplin ändern“, „Scheibe teilen“ und „Scheibe löschen“ als lose Knöpfe
(`CardDiscipline`, `ShareCard`, `DeleteCard` in `apps/spiegel/src/components/card/`), ohne Kasten, mit ungleichen
Abständen. Alles darüber steht in Karten. Der User (26.10.2026): „nicht schön und wirken etwas verloren. Sie passen nicht
in die Aufteilung der Anwendung.“

Zwei Varianten lagen live auf der echten Seite zum Vergleich: A (Aktionen oben unter dem Titel, wie `DetailActionBar`
in conventions §2) und B (ein Kasten „Diese Scheibe“ am Ende, je Aktion eine Zeile mit Zustand). Der User hat **B**
gewählt. B weicht bewusst von §2 ab: Der Kopf der Seite einer Scheibe ist schon voll (Rückweg, Titel, Metazeile,
Beobachtungen, Sprungleiste), die drei Aktionen braucht man selten, und der Kasten zeigt zu jeder Aktion, was gerade gilt.
Die Ausnahme wird in §2 festgehalten.

## Approach

1. **Ein Kasten, drei Zeilen.** Neue Komponente `CardActions` (`apps/spiegel/src/components/card/CardActions.tsx`):
   eine Karte wie die übrigen (`rounded-2xl border border-border bg-card p-4`) mit der Überschrift „Diese Scheibe“ und
   darunter in dieser Reihenfolge (fachlich vor destruktiv) `CardDiscipline`, `ShareCard`, `DeleteCard`. `CardScreen`
   rendert statt der drei Abschnitte nur noch `CardActions`. „Mit der Scheibe davor vergleichen“ bleibt ein eigener
   Kasten darüber.
2. **Eine Form für jede Zeile.** `ActionRow` in eigener Datei (`ActionRow.tsx`, sonst importierten sich
   `CardActions` und die drei Zeilen gegenseitig): links Titel (`h3`) und Zustand, rechts die Aktion, auf
   schmalen Telefonen bricht die Aktion unter den Zustand (`flex-wrap`). Darunter, was zur Zeile gehört (der geteilte
   Link mit „Link kopieren“ und „Senden…“, ein Fehler). Trennlinie zwischen den Zeilen (`divide-y divide-border`). Jede
   der drei Komponenten rendert ihre Zeile über `ActionRow` statt ihres eigenen `section` und behält ihr
   `data-`-Attribut (`data-card-discipline`, `data-share-card`, `data-delete-card`), ihre Dialoge und ihr Blatt.
3. **Kurze Knöpfe, voller Name für Screenreader.** Sichtbar „Ändern“, „Teilen“, „Löschen“; als `aria-label` „Disziplin
   ändern“, „Scheibe teilen“, „Scheibe löschen“ (der sichtbare Text steckt im Namen, WCAG 2.5.3). „Teilen beenden“ und
   „Link kopieren“ bleiben, wie sie sind. Die Skriptprüfung findet Knöpfe über Text oder `aria-label` (`named` in
   `packages/pruefen/src/browser.ts`) und braucht deshalb keine Änderung.
4. **Doku:** conventions §2 (Ausnahme), `spiegel-navigation` (vier Stellen „am Ende der Seite“), `apps/spiegel/CLAUDE.md`
   (zwei Stellen), die Kommentare der drei Komponenten und von `CompareWithPrevious`.

## Textbuch Spiegel (mit dem Plan freigegeben)

Ort: Seite einer Scheibe, Kasten am Ende (nur für den Besitzer, nicht auf der geteilten Seite).

| Stelle | alt | neu |
| --- | --- | --- |
| Überschrift des Kastens | – | „Diese Scheibe“ |
| Zeile Disziplin: Titel | „Disziplin {LP 40}“ in einer Zeile | „Disziplin“ |
| Zeile Disziplin: Zustand | (im Titel) | „{LP 40 alt}“, nach eigener Wahl darunter „Am Stand gewählt: {LP 40}“ (unverändert) |
| Zeile Disziplin: Knopf | „Disziplin ändern“ / „Ändern…“ | „Ändern“ / „Ändern…“, Name „Disziplin ändern“; ohne andere Disziplin kein Knopf (unverändert) |
| Zeile Teilen: Titel | – | „Teilen“ |
| Zeile Teilen: Zustand, nicht geteilt | – | „Nur du siehst diese Scheibe.“ |
| Zeile Teilen: Knopf, nicht geteilt | „Scheibe teilen“ / „Teilen…“ | „Teilen“ / „Teilen…“, Name „Scheibe teilen“ |
| Zeile Teilen: Zustand, geteilt | „Geteilt seit {21.10.2026}“ | „Geteilt seit {21.10.2026}. Wer den Link hat, sieht die Scheibe.“ |
| Zeile Teilen: Knopf, geteilt | „Teilen beenden“ / „Beenden…“ | unverändert, rechts in der Zeile |
| Zeile Teilen: unter dem Zustand | Link, „Link kopieren“, „Senden…“, „Link kopiert“ | unverändert, unter der Zeile |
| Zeile Löschen: Titel | – | „Löschen“ |
| Zeile Löschen: Zustand | – | „Danach liegt die Scheibe 30 Tage im Papierkorb im Profil.“ |
| Zeile Löschen: Knopf | „Scheibe löschen“ / „Löschen…“ | „Löschen“ / „Löschen…“, Name „Scheibe löschen“ |

Die Rückfragen (`cardDiscipline`, `cardShare`, `cardShareStop`, `cardDelete` in `src/lib/admin/consequences.ts`) und
das Blatt „Disziplin ändern“ bleiben unverändert.

## Files to change

| Datei | Task | Änderung |
| --- | --- | --- |
| `apps/spiegel/src/components/card/ActionRow.tsx` | T1 | neu: Zeile mit Titel, Zustand, Aktion |
| `apps/spiegel/src/components/card/ActionRow.test.tsx` | T1 | neu |
| `apps/spiegel/src/components/card/CardActions.tsx` | T5 | neu: Kasten „Diese Scheibe“ |
| `apps/spiegel/src/components/card/CardActions.test.tsx` | T5 | neu: Kasten, Reihenfolge, Löschen |
| `apps/spiegel/src/components/card/CardDiscipline.tsx` | T2 | Zeile über `ActionRow`, Knopf „Ändern“ mit Namen |
| `apps/spiegel/src/components/card/CardDiscipline.test.tsx` | T2 | Erwartungen an Zeile und Knopf |
| `apps/spiegel/src/components/card/ShareCard.tsx` | T3 | Zeile über `ActionRow`, Zustand, Knopf „Teilen“ mit Namen |
| `apps/spiegel/src/components/card/ShareCard.test.tsx` | T3 | Erwartungen an Zeile, `buttonLabels` |
| `apps/spiegel/src/components/card/DeleteCard.tsx` | T4 | Zeile über `ActionRow`, Knopf „Löschen“ mit Namen |
| `apps/spiegel/src/components/card/CardScreen.tsx` | T5 | `CardActions` statt der drei Abschnitte |
| `apps/spiegel/src/components/card/CompareWithPrevious.tsx` | T6 | Kommentar: über dem Kasten „Diese Scheibe“ |
| `vault/conventions.md` | T6 | §2: Ausnahme für Spiegel |
| `vault/spiegel/spiegel-navigation.md` | T6 | vier Stellen „am Ende der Seite“ |
| `apps/spiegel/CLAUDE.md` | T6 | zwei Stellen |

## Required Docs

- `apps/spiegel/CLAUDE.md` (Regeln „Kein Knopf ohne Folge“, „Disziplin je Scheibe“, „Löschen mit Papierkorb“, „Teilen
  per Link“, Skriptprüfung)
- `vault/conventions.md` §2 (Komponenten-Kanon), §3 (Kontrast, Ellipse „…“), §9 (`pending` gilt für die ganze
  Transition), §10 (Design 2, So schreiben wir)
- `vault/spiegel/spiegel-navigation.md`, Abschnitte „Seite einer Scheibe“, „Löschen und Papierkorb“, „Disziplin einer
  Scheibe“, „Teilen per Link“

## Tasks

### T1 — `ActionRow` (Test zuerst)

`apps/spiegel/src/components/card/ActionRow.test.tsx` (Node, `renderToStaticMarkup`):

```tsx
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ActionRow } from "./ActionRow"

describe("Zeile im Kasten „Diese Scheibe“", () => {
  it("Titel als Überschrift, Zustand, Aktion rechts, darunter der Rest", () => {
    const html = renderToStaticMarkup(
      createElement(
        ActionRow,
        {
          title: "Teilen",
          state: "Nur du siehst diese Scheibe.",
          action: createElement("button", { type: "button" }, "Teilen"),
          "data-share-card": true,
        },
        createElement("p", null, "darunter")
      )
    )
    expect(html).toMatch(/^<div data-share-card="true"/)
    expect(html).toMatch(/<h3[^>]*>Teilen<\/h3>[\s\S]*Nur du siehst diese Scheibe\.[\s\S]*<button[^>]*>Teilen<\/button>[\s\S]*darunter/)
  })
})
```

Rot laufen lassen: `pnpm --filter spiegel exec vitest run src/components/card/ActionRow.test.tsx`.

`apps/spiegel/src/components/card/ActionRow.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"

/**
 * Eine Zeile im Kasten „Diese Scheibe“: links Titel und Zustand, rechts die Aktion; auf schmalen Telefonen bricht die
 * Aktion unter den Zustand. Darunter, was zur Zeile gehört (der geteilte Link, ein Fehler). Weitere Props (`data-…`)
 * landen auf der Zeile.
 */
export function ActionRow({
  title,
  state,
  action,
  children,
  ...rest
}: {
  title: string
  state: ReactNode
  action?: ReactNode
  children?: ReactNode
  [data: `data-${string}`]: unknown
}) {
  return (
    <div {...rest} className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 gap-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="text-[13px] text-muted-foreground">{state}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
```

Test grün, Gate, Commit
`feat(spiegel): action row for the card actions box`.

### T2 — Disziplin als Zeile

`CardDiscipline.test.tsx` zuerst anpassen:

- „der Name und „Disziplin ändern“ …“: `expect(html).toMatch(/^<div data-card-discipline="true"/)`,
  `expect(html).toMatch(/<h3[^>]*>Disziplin<\/h3>/)`, `expect(html).toMatch(/data-discipline-name[^>]*>LP 40</)`,
  `expect(html).toMatch(/<button[^>]*aria-label="Disziplin ändern"[^>]*>[\s\S]*?Ändern<\/button>/)`.
- „ohne andere Möglichkeit nur der Name“: `expect(html).not.toContain('aria-label="Disziplin ändern"')`.
- „nach einer eigenen Wahl leise die vom Stand“ bleibt.

Rot laufen lassen, dann `CardDiscipline.tsx`:

- Import `ActionRow` aus `./ActionRow`; `section` → `ActionRow` mit `title="Disziplin"`, `data-card-discipline`, `state`:
  ```tsx
  <>
    <span data-discipline-name className="font-semibold text-foreground">{current}</span>
    {stand && <span data-stand-discipline className="block">Am Stand gewählt: {stand}</span>}
  </>
  ```
- `action`: der Knopf nur bei `options.length > 1`, `aria-label="Disziplin ändern"`, Text
  `{pending ? "Ändern…" : "Ändern"}`, Klassen wie bisher (`BUTTON`).
- Fehler (`role="alert"`), `Sheet` und `DecisionDialog` als `children` der Zeile, Fehler ohne `px-3.5`.
- Kommentar der Komponente: „Disziplin als Zeile im Kasten „Diese Scheibe“: …“ statt „am Ende der Seite einer
  Scheibe, über dem Teilen“.

Test grün, Gate, Commit `refactor(spiegel): discipline as a row of the card actions box`.

### T3 — Teilen als Zeile

`ShareCard.test.tsx` zuerst anpassen:

- nicht geteilt: `expect(html).toMatch(/^<div data-share-card="true"/)`, `<h3[^>]*>Teilen<\/h3>`,
  „Nur du siehst diese Scheibe.“, `/<button[^>]*aria-label="Scheibe teilen"[^>]*>[\s\S]*?Teilen<\/button>/`,
  kein `data-share-link`, kein „Teilen beenden“.
- geteilt: „Geteilt seit 21.10.2026. Wer den Link hat, sieht die Scheibe.“, Link, „Link kopieren</button>“,
  „Teilen beenden</button>“, kein `aria-label="Scheibe teilen"`.
- `buttonLabels`: `share` heißt „Teilen“ / „Teilen…“ statt „Scheibe teilen“ / „Teilen…“; die übrigen Erwartungen
  (nur die laufende Aktion mit „…“) bleiben, mit „Teilen“ statt „Scheibe teilen“.

Rot laufen lassen, dann `ShareCard.tsx`:

- `buttonLabels`: `share: pending && kind === "share" ? "Teilen…" : "Teilen"`.
- Import `ActionRow` aus `./ActionRow`; `section` → `ActionRow` mit `title="Teilen"`, `data-share-card`.
- nicht geteilt: `state="Nur du siehst diese Scheibe."`, `action` = der bisherige Knopf mit
  `aria-label="Scheibe teilen"` und `{labels.share}`.
- geteilt: `state={`Geteilt seit ${formatDateOnly(new Date(share.sharedAtMs), timeZone)}. Wer den Link hat, sieht die Scheibe.`}`,
  `action` = „Teilen beenden“ (unverändert), als `children`: der Link (`data-share-link`, unverändert), die Zeile mit
  „Link kopieren“ und „Senden…“, der Status „Link kopiert“.
- Fehler und `DecisionDialog` als `children`; Fehler ohne `px-3.5`.
- Kommentar der Komponente: „Teilen als Zeile im Kasten „Diese Scheibe“: …“.

Test grün, Gate, Commit `refactor(spiegel): sharing as a row of the card actions box`.

### T4 — Löschen als Zeile

`DeleteCard.tsx` hat keinen eigenen Test; die Zeile prüft T5 im Kasten. Änderung:

- Import `ActionRow` aus `./ActionRow`; `section` → `ActionRow` mit `title="Löschen"`, `data-delete-card`,
  `state="Danach liegt die Scheibe 30 Tage im Papierkorb im Profil."`.
- `action`: der bisherige Knopf mit `aria-label="Scheibe löschen"`, Text `{pending ? "Löschen…" : "Löschen"}`.
- Fehler und `DecisionDialog` als `children`.
- Kommentar: „Löschen als Zeile im Kasten „Diese Scheibe“: …“.

Gate, Commit `refactor(spiegel): deleting as a row of the card actions box`.

### T5 — `CardActions` und `CardScreen` (Test zuerst)

Neue Datei `CardActions.test.tsx`, die Actions gemockt (`async () => ({ success: true })`):

```tsx
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, replace: () => {} }) }))
vi.mock("@/lib/card-discipline-actions", () => ({ setCardDiscipline: async () => ({ success: true }) }))
vi.mock("@/lib/share-actions", () => ({
  shareCard: async () => ({ success: true }),
  stopSharingCard: async () => ({ success: true }),
}))
vi.mock("@/lib/trash-actions", () => ({
  deleteCard: async () => ({ success: true }),
  restoreCard: async () => ({ success: true }),
}))

const { CardActions } = await import("./CardActions")

describe("Kasten „Diese Scheibe“", () => {
it("ein Kasten mit Überschrift, darin Disziplin, Teilen, Löschen in dieser Reihenfolge", () => {
  const html = renderToStaticMarkup(
    createElement(CardActions, {
      cardId: "c1",
      when: "Di 13.10.2026 · 19:12",
      timeZone: "Europe/Berlin",
      discipline: { current: "LP 40", family: "Luftpistole", scoring: "rings", stand: null, options: [] },
      share: null,
      onShareChange: () => {},
      back: "/cards",
    })
  )
  expect(html).toMatch(/^<section data-card-actions="true" aria-labelledby="card-actions-title" class="[^"]*rounded-2xl[^"]*bg-card/)
  expect(html).toMatch(/<h2 id="card-actions-title"[^>]*>Diese Scheibe<\/h2>/)
  const order = ["data-card-discipline", "data-share-card", "data-delete-card"].map((a) => html.indexOf(a))
  expect(order.every((i) => i > 0)).toBe(true)
  expect(order).toEqual([...order].sort((a, b) => a - b))
  expect(html).toContain("Danach liegt die Scheibe 30 Tage im Papierkorb im Profil.")
  expect(html).toMatch(/<button[^>]*aria-label="Scheibe löschen"[^>]*>[\s\S]*?Löschen<\/button>/)
})
})
```

Rot laufen lassen, dann `CardActions.tsx` (`"use client"`, Importe `CardDiscipline`, `ShareCard`, `DeleteCard`,
`type Share` aus `@/lib/share-actions`):

```tsx
/**
 * Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe, nur für den Besitzer: Disziplin, Teilen und Löschen als
 * Zeilen, fachlich vor destruktiv. Am Ende statt oben (Ausnahme zu conventions §2): Der Kopf der Seite ist voll, die
 * Aktionen braucht man selten, und jede Zeile zeigt, was gerade gilt.
 */
export function CardActions({ cardId, when, timeZone, discipline, share, onShareChange, back }: {
  cardId: string
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfragen */
  when: string
  timeZone: string
  discipline: Omit<Parameters<typeof CardDiscipline>[0], "cardId" | "when">
  share: Share | null
  onShareChange: (share: Share | null) => void
  /** der Rückweg nach dem Löschen */
  back: string
}) {
  return (
    <section data-card-actions aria-labelledby="card-actions-title" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="card-actions-title" className="mb-3 text-[15px] font-semibold">Diese Scheibe</h2>
      <div className="grid divide-y divide-border">
        <CardDiscipline cardId={cardId} when={when} {...discipline} />
        <ShareCard cardId={cardId} when={when} share={share} onChange={onShareChange} timeZone={timeZone} />
        <DeleteCard cardId={cardId} when={when} back={back} shared={share !== null} />
      </div>
    </section>
  )
}
```

`CardScreen.tsx` (Zeilen 505–530): die drei Komponenten durch einen Aufruf ersetzen, Importe anpassen:

```tsx
{own && (
  <>
    {own.previous && <CompareWithPrevious cardId={card.id} previous={own.previous} />}
    <CardActions
      cardId={card.id}
      when={cardWhen(card.startedAtMs, pageContext.timeZone)}
      timeZone={pageContext.timeZone}
      discipline={{
        current: card.discipline,
        family: card.family?.name ?? null,
        scoring: card.scoring,
        stand: card.standDiscipline,
        options: own.disciplines,
      }}
      share={share}
      onShareChange={setShare}
      back={urlFromRoute(backRoute(route))}
    />
  </>
)}
```

Test grün, Gate, Commit `feat(spiegel): card actions box at the end of a card page`.

### T6 — Doku

- `vault/conventions.md` §2, an „Detail-Aktionen“ anhängen: „Ausnahme Spiegel: Die Seite einer Scheibe ist lang und
  oben voll (Rückweg, Titel, Beobachtungen, Sprungleiste). Ihre seltenen Aktionen (Disziplin, Teilen, Löschen) stehen
  am Ende im Kasten „Diese Scheibe“ (`CardActions`), je eine Zeile mit Zustand und Aktion rechts, fachlich vor
  destruktiv.“
- `vault/spiegel/spiegel-navigation.md`: Zeile 276 „Löschen am Ende der Seite“ → „Disziplin, Teilen und Löschen am Ende
  im Kasten „Diese Scheibe“ (`CardActions`), je eine Zeile mit Zustand und Aktion“; Zeilen 313, 336, 355 „am Ende der
  Seite einer Scheibe (…)“ → „als Zeile im Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe (…)“, die Wörter der
  Knöpfe nach dem Textbuch oben („Ändern“, „Teilen“, „Löschen“).
- `apps/spiegel/CLAUDE.md` Zeile 147 („Bedient am Ende der Seite einer Scheibe über dem Teilen“) und Zeile 288 („Der
  Knopf steht am Ende der Seite einer Scheibe“) → „im Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe“.
- `CompareWithPrevious.tsx` Kommentar: „über dem Kasten „Diese Scheibe““ statt „über dem Teilen“.
- `node .claude/vault-lint.mjs` grün.

Commit `docs: card actions box at the end of a card page`.

## Verification

1. `pnpm check` grün.
2. Gegenprobe per Mutation (Dateien mit `cp` sichern): in `CardActions` die Reihenfolge von Teilen und Löschen tauschen
   → der Test der Reihenfolge wird rot; in `ShareCard` das `aria-label` entfernen → der Test des Knopfs wird rot.
3. Im Browser (Dev-Server, eigenes Konto): Seite einer Scheibe am Desktop und bei 375 px: ein Kasten „Diese Scheibe“,
   drei Zeilen, Aktion rechts bzw. darunter, keine seitliche Rolle; Teilen bis zum Link und zurück, „Disziplin ändern“
   öffnet das Blatt (ohne Ändern schließen), „Löschen“ öffnet die Rückfrage (Abbrechen). Die Scheibe am Ende ungeteilt.
   Geteilte Seite `/share/…`: kein Kasten.
4. `pnpm --filter spiegel pruefen`: 0 FAIL (die Knöpfe findet sie über die Namen).
