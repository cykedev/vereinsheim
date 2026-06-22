# Design: Optimistic UI-Updates (R-15)

**Datum:** 2026-03-29
**Status:** Approved
**Scope:** ResultEntryDialog, EnrollParticipantForm

---

## Problem

Alle Server Actions blockieren die UI bis zum Abschluss. Bei der Ergebniseingabe und beim Einschreiben ist das spürbar: Inputs sind während des Server-Round-Trips disabled, der Dialog bleibt offen, das Formular blockiert.

---

## Ziel

Dialog/Formular schließt sich bzw. leert sich **sofort** nach dem Klick. Der Server-Round-Trip läuft im Hintergrund. Fehler werden per Toast gemeldet.

Keine Änderungen an Server Actions, Datenbankstruktur oder umgebenden Server-Component-Seiten.

---

## Ansatz: Fire-and-forget mit `useTransition`

Konsistent mit dem bestehenden Muster in `CompetitionActions`, `DisciplineActions`, `GenerateScheduleButton` etc. Kein neues Konzept im Codebase.

---

## Komponente 1: ResultEntryDialog

**Datei:** `src/components/app/results/ResultEntryDialog.tsx`

### Verhalten

- Client-Validierung (Zahlenwerte, Positiv-Check) läuft wie bisher
- Bei bestandener Validierung: Dialog schließt sofort (`setOpen(false)`)
- Server Action `saveMatchResult` wird in `startTransition` aufgerufen
- Fehler → `toast.error(result.error)`
- `isPending` bleibt als Guard gegen Doppel-Submit beim Schließen; entfernt `disabled`-Attribute da Dialog zu ist

### Änderungen

- `handleSubmit`: `setOpen(false)` vor `startTransition` einfügen
- `toast` aus `sonner` importieren
- `disabled={isPending}` von Inputs entfernen (Dialog ist bei Submit bereits zu)
- Kein Umbau des Props-Interfaces, keiner umgebenden Seite

---

## Komponente 2: EnrollParticipantForm

**Datei:** `src/components/app/competitionParticipants/EnrollParticipantForm.tsx`

### Verhalten

- Button-Klick: Formular leert sich sofort (`isGuest`/`newTeam` → false, `formKey` inkrementieren → native Form-Reset)
- Server Action läuft im Hintergrund via `startTransition`
- Fehler → `toast.error()`
- Field-level Errors (`fieldErrors`, `generalError` im DOM) entfallen — Fehler kommen nur per Toast

### Änderungen

- `useActionState` → `useTransition` (kein `state` mehr aus der Action)
- `formRef: RefObject<HTMLFormElement>` auf `<form>`
- `formKey: number` State → auf `<form key={formKey}>` gesetzt
- Submit-Handler auf Button `onClick`: `new FormData(formRef.current!)` erfassen, State resetten, `formKey++`, dann in `startTransition` Action aufrufen
- `action`-Prop: Typ bleibt `(prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>` — wird nun direkt als `action(null, formData)` aufgerufen

### Trade-offs

- **Field-level Errors entfallen** — in der Praxis kaum relevant, da Button disabled bleibt wenn keine Auswahl getroffen wurde (Zod-Validierung nur noch als Toast)
- `competitionId`-Prop ist aktuell in der Form ungenutzt — keine Änderung

---

## Tests

Keine bestehenden Tests für `ResultEntryDialog` oder `EnrollParticipantForm` (reine UI-Komponenten). Kein neuer Test-Code erforderlich.

---

## Nicht im Scope

- Optimistische Tabellenzeilen-Updates (würde `ScheduleView` zum Client Component machen)
- Optimistische Teilnehmerlisten-Updates (würde Server Component-Seite umbauen)
- `useOptimistic` Hook (nicht nötig für dieses UX-Ziel)
- React 19 `useOptimistic` für inhaltliche State-Changes
