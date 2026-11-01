# U2: Der Ort an jeder Scheibe ohne Brücke an einer Stelle

Teilplan des Koordinationsplans [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md). Branch
`feat/tis-u2-place-row` vom Basisbranch `feat/treffsicher-in-spiegel`. Befund des Users am 1. November 2026: „Warum kann
ich manchmal einen Ort eintragen und manchmal nicht?“ Das Konzept hat der User am selben Tag freigegeben.

## Kontext

Wo der Ort einer Scheibe geändert wird, hängt heute an ihrer Herkunft (`cardEntryInfo` in
`apps/spiegel/src/lib/entered/queries.ts`):

| Herkunft | Ort heute |
|---|---|
| von der Anlage (`raw`) | keiner, der Ort ist die Anlage |
| vom Ausdruck (`pdf`) | eigene Zeile „Ort“ mit „Ändern“ im Kasten „Diese Scheibe“ (`CardPlace`) |
| von Hand (`manual`) | nur im Formular hinter „Ändern“ |
| aus Treffsicher (`treffsicher`) | nur im Formular, und das gibt es nur, wenn es alle Angaben zeigen kann (`editable`) |

Bei übernommenen Scheiben, die das Formular nicht ganz zeigen kann, fehlt „Ändern“. Damit gibt es dort keinen Weg zum
Ort. Die Server-Action `setCardPlace` (`src/lib/card-place-actions.ts`) erlaubt schon `pdf`, `manual` und `treffsicher`.
Es fehlt nur die Oberfläche.

## Ansatz (freigegebenes Konzept)

- **Eine Stelle:** Jede eigene Scheibe, die nicht von der Anlage kommt, zeigt die Zeile „Ort“ mit „Ändern“
  (`CardPlace`) im Kasten „Diese Scheibe“. Das gilt für `pdf`, `manual` und `treffsicher`, unabhängig von `editable`.
  Reihenfolge wie heute: nach Eintrag, Ausdruck und Auftrag, vor den Belegen.
- **Formular:** Beim Anlegen (`/cards/new`) bleibt das Feld „Ort“, dort entsteht die Scheibe erst. Beim Ändern
  (`/cards/[id]/edit`) fällt das Feld weg, es gibt also nur einen Weg.
- **Kein stiller Verlust** (Konvention §9, Drei-Wege-Semantik): `saveEnteredCard` übergibt beim Ändern (`cardId`
  gesetzt) `place: undefined` an `writeEnteredCard`. Die Spalte bleibt dann unberührt. Der Ort aus dem Formular zählt
  nur beim Anlegen. So überschreibt ein alter Tab oder ein Formular ohne Feld keinen Ort, der über die Zeile gesetzt
  wurde.
- **Übernahme:** Ein von Hand gesetzter Ort macht eine übernommene Scheibe für einen späteren Lauf zu „geändert, bleibt“
  (`cardState` in `src/parts/transfer/ledger.ts` enthält `place`). Daran ändert sich nichts.
- **Texte:** keine neuen. Die Zeile „Ort“ mit „Kein Ort angegeben“ und „Ort ändern“ gibt es schon.

## Dateien

- `apps/spiegel/src/lib/entered/queries.ts`: `CardEntryInfo` wird zu
  `{ entry: { from: "manual" | "treffsicher"; editable: boolean } | null; place: string | null; places: string[] }`,
  oder gleichwertig. Wichtig ist nur, dass `pdf`, `manual` und `treffsicher` den Ort tragen. `raw` liefert weiter
  `null`.
- `apps/spiegel/src/components/card/CardActions.tsx`: `CardEntry` nur für eingetragene, `CardPlace` für alle mit Ort.
  Dazu jeder Aufrufer, der `CardEntryInfo` liest; die Aufrufer findet `codegraph_explore` für `cardEntryInfo`.
- `apps/spiegel/src/lib/entered/actions.ts`: `place` nur beim Anlegen.
- `apps/spiegel/src/components/entered/EnteredCardForm.tsx`: Feld „Ort“ und `datalist` nur bei `mode === "new"`.
  `places` wird für `edit` optional.
- `apps/spiegel/src/app/(app)/cards/[id]/edit/page.tsx`: `ownPlaces` fällt weg.
- Tests:
  - `src/components/card/CardActions.test.tsx`, Abschnitt „Eintrag und Ort je Herkunft“,
  - `src/lib/entered/actions.test.ts`,
  - ein Markup-Test des Formulars in beiden Modi, falls es einen gibt, sonst ein neuer,
  - Tests zu `cardEntryInfo`, falls vorhanden.
- Doku:
  - die Vault-Note zur Seite einer Scheibe bzw. zu eingetragenen Scheiben (`mcp__memory__search_nodes` „Ort einer
    Scheibe ändern“),
  - `apps/spiegel/CLAUDE.md`, falls der Ort dort steht.

## Required Docs

- `vault/conventions.md` §2 (Kasten „Diese Scheibe“, `CardActions`) und §9 („Bedingt ausgeblendete Formularfelder
  brauchen im Update Drei-Wege-Semantik“, „Formulare mit Server Action gesteuert halten“, „Aussagen über UI-Pfade an der
  UI prüfen“).
- `vault/decisions/adr-033.md` (eingetragene Scheiben, Ort als Freitext).
- `apps/spiegel/CLAUDE.md`.

## Aufgaben

1. **Daten:** `cardEntryInfo` liefert den Ort für `pdf`, `manual` und `treffsicher`. Test je Herkunft, `raw` ohne Ort.
2. **Kasten:** `CardActions` zeigt `CardPlace` für alle drei. Markup-Tests:
   - eingetragen mit „Ändern“ und Ort-Zeile,
   - aus Treffsicher ohne „Ändern“ und mit Ort-Zeile (der Fall des Users),
   - vom Ausdruck wie heute,
   - von der Anlage ohne beides.
3. **Formular:** Beim Ändern kein Feld „Ort“, beim Anlegen weiter. Markup-Test beider Modi.
4. **Action:** Beim Ändern bleibt `place` unberührt. Test: Eine Scheibe mit Ort „Halle“, geändert über `saveEnteredCard`
   mit `form.place` leer, behält „Halle“. Gegenprobe: Wird `form.place` beim Ändern wieder übergeben, muss der Test rot
   werden.
5. **Doku:** Vault-Note und `apps/spiegel/CLAUDE.md`, `vault-lint` grün.

## Test steps

- `pnpm check` (alle fünf Gates) grün.
- Mutationsprobe aus Aufgabe 4, aus einer `cp`-Sicherung zurückgespielt.
- Browser auf eigenem Port des Worktrees, nur lesend, angemeldet als der User. Zu zeigen sind eine übernommene Scheibe
  ohne „Ändern“ und eine von Hand eingetragene Scheibe:
  - Die Zeile „Ort“ steht da.
  - Im Formular „Eintrag ändern“ gibt es kein Feld „Ort“.
  - Das Formular „Ergebnis eintragen“ hat das Feld weiter.

  Einen Ort zu setzen schreibt in die Dev-Datenbank. Das passiert nur nach Signal des Koordinators und an einer Scheibe,
  die der User nennt. Sonst steht es als „nicht belegt“ im Bericht, mit dem Test, der es abdeckt.
- Keine Skriptprüfung nötig. Läuft sie trotzdem, dann nur nach Signal.

## Verification

- Jede eigene Scheibe ohne Brücke hat genau einen Weg zum Ort.
- Kein Ort geht beim Ändern des Eintrags verloren.
- Scheiben der Anlage sind unverändert.
- Keine Migration, keine neuen Texte. Die Brücke braucht kein Update.
