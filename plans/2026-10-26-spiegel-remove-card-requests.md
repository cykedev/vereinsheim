# Spiegel: Aufträge „Scheibe per ID“ ohne Ergebnis entfernen

## Context

Der User (26. Oktober 2026): „bei den ‚scheiben per ID‘ würde ich aufträge, die nichts gefunden haben, gerne selbe
wieder löschen können“. Die Frist bleibt: Ein Auftrag ohne Antwort der Anlage verfällt nach 30 Tagen
(`REQUEST_DAYS`).

Heute zeigt das Profil unter „Scheibe per ID holen“ die offenen Aufträge und die der letzten 30 Tage. Ein wartender
lässt sich zurückziehen, ein beendeter bleibt bis zum Ablauf der 30 Tage stehen, auch ohne Scheibe.

## Approach

- **D1 Was sich entfernen lässt:** jeder beendete Auftrag ohne Scheibe. Das sind die Zustände `missing` („nicht
  gefunden“), `mismatch` („an diesem Tag nicht gefunden“), `expired` („keine Antwort von der Anlage“), `held` („lässt
  sich nicht holen“), `taken` („gehört zu einem anderen Konto“) und `withdrawn` („zurückgezogen“). Ein Auftrag mit
  Scheibe ist `open` oder `done` und bleibt. Er verweist auf die Scheibe, und die löscht man auf ihrer Seite. Die
  Regel steht als reine Funktion an einer Stelle (`isRemovable` in `src/lib/card-requests/status.ts`), Oberfläche und
  Abfrage nehmen beide sie.
- **D2 Entfernen löscht die Zeile.** Auf `CardRequest` zeigt keine andere Tabelle, und der Auftrag hat ohne Scheibe
  keinen Wert mehr (Datensparsamkeit). Die Abfrage trägt Besitzer und Zustand selbst
  (`deleteMany where { id, userId, status in REMOVABLE }`). Ein zweiter Klick oder ein fremder Auftrag ändert nichts.
- **D3 Rückfrage wie beim Zurückziehen** ([[conventions]] §10, „Kein Knopf ohne Folge“): `DecisionDialog` mit neuem
  Text `cardRequestRemove` in `src/lib/admin/consequences.ts`. Wortlaut (fürs Textbuch Spiegel, mit dem Plan
  freigegeben):
  - Titel: „Auftrag entfernen?“
  - Worum es geht: „Spiegel hat die Scheibe mit der ID {id} vom {Tag} nicht geholt.“
  - Was passiert: „Der Auftrag verschwindet aus dieser Liste.“
  - Was nicht passiert: „Deine Scheiben und die anderen Aufträge bleiben.“ und „An der Meyton-Anlage ändert sich
    nichts.“
  - Rückgängig: „Die Scheibe hier neu anfragen.“
  - Knopf: „Entfernen“ (zerstörerisch, wie „Zurückziehen“)
- **D4 Knopf in der Liste:** „Entfernen“ rechts in der Zeile, gestaltet wie „Zurückziehen“, nur bei `isRemovable`.
- **Kein Schema, keine Migration, keine Brücke.** Nur Spiegel: Release auf den VPS nötig, **Brücke: kein Update
  nötig.**

## Files

- neu `apps/spiegel/src/lib/card-requests/status.ts` (`REMOVABLE_STATUSES`, `isRemovable`)
- `apps/spiegel/src/lib/card-requests/queries.ts` (`removeRequest`), `queries.test.ts`
- `apps/spiegel/src/lib/card-requests/actions.ts` (`removeCardRequest`), `actions.test.ts`
- `apps/spiegel/src/lib/admin/consequences.ts` (`cardRequestRemove`), `consequences.test.ts`
- `apps/spiegel/src/components/profile/CardRequests.tsx`, `CardRequests.test.tsx`
- `apps/spiegel/tools/pruefen.ts` (Abschnitt „Scheibe per ID holen“)
- `apps/spiegel/CLAUDE.md` (Regel „Scheibe per ID holen“), `vault/spiegel/spiegel-assignment.md` („Scheibe per ID
  (gebaut)“, Punkt 1)

## Required Docs

- `apps/spiegel/CLAUDE.md` (Scheibe per ID holen, Kein Knopf ohne Folge, Wortlaut nach dem Textbuch, Skriptprüfung,
  Tests gegen die Dev-Datenbank)
- `vault/conventions.md` §2 (Bestätigungen), §6 (ActionResult), §10 (So schreiben wir)
- `vault/spiegel/spiegel-assignment.md` („Scheibe per ID (gebaut)“)

## Tasks

1. **Regel und Abfrage, Test zuerst:**
   - `status.ts`:
     ```ts
     import type { CardRequestStatus } from "@/generated/prisma/client"

     /** beendet ohne Scheibe: Der Schütze kann den Auftrag aus der Liste entfernen. Mit Scheibe ist er `open` oder `done` */
     export const REMOVABLE_STATUSES = ["missing", "mismatch", "expired", "held", "taken", "withdrawn"] as const satisfies readonly CardRequestStatus[]

     export const isRemovable = (status: CardRequestStatus): boolean =>
       (REMOVABLE_STATUSES as readonly CardRequestStatus[]).includes(status)
     ```
   - `queries.test.ts`, neuer Block `describe("removeRequest", …)` mit der Anlage und den Konten des Blocks
     `withdrawRequest und Frist`: je ein eigener Auftrag mit `missing`, `withdrawn`, `open` und `done` (`status` per
     `db.cardRequest.update` gesetzt). Ein fremdes Konto entfernt nichts (`false`). Der eigene mit `missing` → `true`,
     danach `false`. `withdrawn` → `true`. `open` und `done` → `false` und stehen noch in der Datenbank.
   - `queries.ts`:
     ```ts
     /** einen eigenen, beendeten Auftrag ohne Scheibe entfernen (`isRemovable`); false, wenn es keinen solchen gibt */
     export async function removeRequest(db: Db, input: { userId: string; requestId: number }): Promise<boolean> {
       const { count } = await db.cardRequest.deleteMany({
         where: { id: input.requestId, userId: input.userId, status: { in: [...REMOVABLE_STATUSES] } },
       })
       return count === 1
     }
     ```
   - Ein Test in einer neuen `status.test.ts`: `isRemovable` ist für genau die sechs Zustände wahr, für `open` und
     `done` falsch. Geprüft werden alle Werte von `Object.values(CardRequestStatus)` (Laufzeit-Objekt aus
     `@/generated/prisma/enums`), damit ein neuer Zustand auffällt.
2. **Action, Test zuerst:**
   - `actions.test.ts`: `removeCardRequest` für einen fremden Auftrag, einen offenen und `-1` →
     `{ error: "Dieser Auftrag lässt sich nicht entfernen. Lade die Seite neu." }`. Für einen eigenen, zurückgezogenen
     (`withdrawCardRequest` vorher) → `{ success: true }`, ein zweites Mal wieder der Fehler. Mock von
     `next/cache` wie in der Datei.
   - `actions.ts`:
     ```ts
     /** einen eigenen, beendeten Auftrag ohne Scheibe aus der Liste entfernen */
     export async function removeCardRequest(requestId: number): Promise<ActionResult> {
       try {
         const userId = await shooterId()
         if (!userId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
         if (!isRowId(requestId) || !(await removeRequest(db, { userId, requestId })))
           return { error: "Dieser Auftrag lässt sich nicht entfernen. Lade die Seite neu." }
         revalidatePath("/profile")
         return { success: true }
       } catch {
         return { error: "Der Auftrag ließ sich nicht entfernen." }
       }
     }
     ```
3. **Text, Test zuerst:**
   - `consequences.test.ts` neben `cardRequestWithdraw`: `wellFormed(d)`, Titel „Auftrag entfernen?“, `about` enthält
     ID und Tag, `happens` gleich `["Der Auftrag verschwindet aus dieser Liste."]`, `notHappening` wie in D3,
     `confirmLabel` „Entfernen“, `destructive` wahr.
   - `consequences.ts`, nach `cardRequestWithdraw`:
     ```ts
     /** einen beendeten Auftrag per ID ohne Scheibe aus der Liste entfernen */
     export function cardRequestRemove({ id, day }: { id: string; day: string }): Decision {
       return {
         title: "Auftrag entfernen?",
         about: `Spiegel hat die Scheibe mit der ID ${id} vom ${day} nicht geholt.`,
         happens: ["Der Auftrag verschwindet aus dieser Liste."],
         notHappening: ["Deine Scheiben und die anderen Aufträge bleiben.", "An der Meyton-Anlage ändert sich nichts."],
         undo: "Die Scheibe hier neu anfragen.",
         confirmLabel: "Entfernen",
         destructive: true,
       }
     }
     ```
     In `consequences.test.ts` die Liste der Texte, die `OLD_WORDS` prüft (dort steht
     `["Auftrag zurückziehen", cardRequestWithdraw(…)]`), um `["Auftrag entfernen", cardRequestRemove({ id: "ff914420",
     day: "Di 21.10.2026" })]` ergänzen.
4. **Oberfläche, Test zuerst:**
   - `CardRequests.test.tsx`: Mock um `removeCardRequest` ergänzen. Neuer Fall: Liste mit `open`, `done` (mit
     `cardId`), `missing`, `mismatch`, `expired`, `held`, `taken`, `withdrawn` → genau sechs `Entfernen</button>`, genau
     ein `Zurückziehen</button>`. Die Zeile mit `open` und die mit `done` haben kein „Entfernen“ (über
     `data-card-request="open"` bzw. `"done"` und das Markup der Zeile prüfen).
   - `CardRequests.tsx`: Import `isRemovable` aus `@/lib/card-requests/status`, `cardRequestRemove`,
     `removeCardRequest`. Zustand `removing: OwnRequest | null`. In der Zeile nach dem Knopf „Zurückziehen“:
     ```tsx
     {isRemovable(request.status) && (
       <button type="button" disabled={pending} onClick={() => setRemoving(request)} className={…dieselben Klassen wie „Zurückziehen“…}>
         Entfernen
       </button>
     )}
     ```
     Die Klassen des Knopfs „Zurückziehen“ als Konstante `ROW_ACTION` herausziehen und beide nehmen sie. Ein zweiter
     `DecisionDialog` wie beim Zurückziehen: `cardRequestRemove({ id: removing.hex, day: dayText(removing.day) })`,
     beim Bestätigen `removeCardRequest(removing.id)`, Fehler über `getErrorMessage(result) ?? "Der Auftrag ließ sich
     nicht entfernen."` in `error`, sonst `router.refresh()`. Kommentar der Komponente um „ein beendeter ohne Scheibe
     lässt sich entfernen“ ergänzen.
5. **Skriptprüfung** (`tools/pruefen.ts`, Funktion `cardRequests`), nach der bestehenden Prüfung mit „Abbrechen“:
   - mit der ID `7fff0abc` und dem Tag von heute „Scheibe holen“ → im Dialog „Scheibe holen“ bestätigen → die Liste hat
     eine Zeile mehr mit `7fff0abc` und „wartet auf die Anlage“;
   - in dieser Zeile „Zurückziehen“ → bestätigen → die Zeile zeigt „zurückgezogen“ und einen Knopf „Entfernen“;
   - „Entfernen“ → der Dialog enthält „verschwindet aus dieser Liste“ → „Entfernen“ bestätigen → die Liste hat wieder
     `before` Zeilen, keine mit `7fff0abc`.
   - Am Anfang: steht schon eine Zeile mit `7fff0abc` da (abgebrochener Lauf), sie erst zurückziehen und entfernen.
   - Kommentar der Funktion ergänzen. Prüfung mit `check(…)` je Schritt.
6. **Doku:** `apps/spiegel/CLAUDE.md`, Regel „Scheibe per ID holen“: „Ein beendeter Auftrag ohne Scheibe lässt sich im
   Profil entfernen (`isRemovable` in `src/lib/card-requests/status.ts`, `removeRequest` löscht die Zeile, Text
   `cardRequestRemove`).“ `vault/spiegel/spiegel-assignment.md`, „Scheibe per ID (gebaut)“, Punkt 1, nach „ein
   wartender lässt sich zurückziehen“: „ein beendeter ohne Scheibe (nicht gefunden, an diesem Tag nicht gefunden, keine
   Antwort, gehalten, vergeben, zurückgezogen) lässt sich entfernen“.
7. **Gate:** `pnpm check` vom Root.

## Verification

- `pnpm check` grün.
- Mutation: in `isRemovable` `"withdrawn"` streichen → `status.test.ts` und `CardRequests.test.tsx` fallen; in
  `removeRequest` die Bedingung auf `status` streichen → `queries.test.ts` fällt (`open` würde entfernt).
- Skriptprüfung gegen den eigenen Build:
  `pnpm --filter spiegel build && pnpm --filter spiegel seed:own --demo && pnpm --filter spiegel pruefen --start --nur "Scheibe per ID"; pnpm --filter spiegel seed:own`
  (in einem Befehl, damit das eigene Konto danach wieder steht). Ohne FAIL.
- Im Browser (Bildschirmfoto): ein Auftrag mit „nicht gefunden“ hat „Entfernen“, ein wartender nur „Zurückziehen“.
