# Preserve Form Values on Validation Error — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bei allen 8 betroffenen Forms bleiben die User-Eingaben nach einem Validierungsfehler erhalten.

**Architecture:** Alle uncontrolled Inputs (`defaultValue` + `name`) werden auf controlled Inputs umgestellt — jedes Feld bekommt einen lokalen `useState`, `value=`, `onChange=`. React 19 setzt dann nicht mehr automatisch zurück.

**Tech Stack:** Next.js 16, React 19, TypeScript, Server Actions, Zod, shadcn/ui.

---

## Required Docs

Subagents müssen vor jedem Task lesen:

- `.claude/docs/code-conventions.md`
- `.claude/docs/ui-patterns.md`
- `.claude/docs/reference-files.md`

Zusätzlich für jeden Task: das Spec `.claude/docs/superpowers/specs/2026-05-08-preserve-form-values-design.md`.

## Reference Pattern

`src/components/app/results/ResultEntryDialog.tsx` ist ein bestehendes Beispiel für controlled Inputs in diesem Codebase. Das Muster:

```tsx
const [home, setHome] = useState<ParticipantResult>({
  rings: existingHome ? String(existingHome.rings) : "",
  teiler: existingHome ? String(existingHome.teiler) : "",
})
// …
<Input
  value={home.rings}
  onChange={(e) => setHome((p) => ({ ...p, rings: e.target.value }))}
/>
```

**Wichtig:**

- `value` muss **immer ein String** sein — nie `number | undefined`. Bei numerischen Feldern: `String(initialValue)` oder `""`.
- `defaultValue` für `Select` (shadcn) bleibt: das ist nicht das HTML-`defaultValue`, sondern ein Prop des Radix-Wrappers. Bei `Select` ist das Pattern bereits richtig (entweder `value` + `onValueChange` controlled, oder `defaultValue` — letzteres wird beim React-19-Reset NICHT auf den Initialwert zurückgesetzt, weil Radix das selbst managed). Selects, die schon `value` + `onValueChange` haben (z.B. in `CompetitionForm`), bleiben unverändert.
- `Checkbox`/Hidden-Inputs die bereits controlled sind (siehe `CompetitionForm`: `allowGuests`), bleiben unverändert.
- Native `<input type="checkbox" defaultChecked={…}>` (siehe `CompetitionForm`: `playoffHasViertelfinale`, `playoffHasAchtelfinale`) wird bei Form-Reset auf den initialen `defaultChecked` zurückgesetzt → muss ebenfalls auf controlled umgestellt werden.

## Task Decomposition

Ein Task pro Form (8 Tasks). Jeder Task ist isoliert; keine Reihenfolgenabhängigkeit. Subagents können parallel laufen.

Reihenfolge der Aufzählung folgt User-Priorität (Kranzl-Eingabe zuerst):

---

### Task 1: EventSeriesDialog — controlled Inputs

**Files:**

- Modify: `src/components/app/series/EventSeriesDialog.tsx`

- [ ] **Step 1: Lokalen State für `rings` + `teiler` einführen**

In `EventSeriesDialog`:

```tsx
import { useEffect, useState, useActionState } from "react"
// …
const [rings, setRings] = useState<string>(existingSeries ? String(existingSeries.rings) : "")
const [teiler, setTeiler] = useState<string>(existingSeries ? String(existingSeries.teiler) : "")
```

- [ ] **Step 2: Inputs controlled machen**

```tsx
<RingsInput
  id="rings"
  name="rings"
  scoringType={scoringType}
  shotsPerSeries={shotsPerSeries}
  value={rings}
  onChange={(e) => setRings(e.target.value)}
  disabled={isPending}
  autoFocus
/>
```

```tsx
<Input
  id="teiler"
  name="teiler"
  type="text"
  inputMode="decimal"
  value={teiler}
  onChange={(e) => setTeiler(e.target.value)}
  placeholder="z.B. 3,7"
  disabled={isPending}
/>
```

- [ ] **Step 3: Beim Erfolg State zurücksetzen**

`setOpen(false)` ist bereits da (im `useActionState`-Wrapper). Zusätzlich beim Schliessen den State auf den Initialwert zurücksetzen, damit beim erneuten Öffnen frisch gestartet wird:

```tsx
function handleOpenChange(isOpen: boolean) {
  if (!isOpen) {
    setRings(existingSeries ? String(existingSeries.rings) : "")
    setTeiler(existingSeries ? String(existingSeries.teiler) : "")
  }
  setOpen(isOpen)
}
// …
<Dialog open={open} onOpenChange={handleOpenChange}>
```

- [ ] **Step 4: `/check`**

Erwartung: alle Gates grün.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/series/EventSeriesDialog.tsx
git commit -m "fix: preserve EventSeriesDialog values on validation error"
```

---

### Task 2: SeasonSeriesDialog — controlled Inputs

**Files:**

- Modify: `src/components/app/series/SeasonSeriesDialog.tsx`

- [ ] **Step 1: Lokalen State für `sessionDate`, `rings`, `teiler` einführen**

```tsx
const [sessionDate, setSessionDate] = useState<string>(
  existingSeries?.sessionDate ?? new Date().toISOString().slice(0, 10)
)
const [rings, setRings] = useState<string>(existingSeries ? String(existingSeries.rings) : "")
const [teiler, setTeiler] = useState<string>(existingSeries ? String(existingSeries.teiler) : "")
```

`selectedDisciplineId` ist bereits controlled — bleibt.

- [ ] **Step 2: Inputs controlled machen**

```tsx
<Input
  id="sessionDate"
  name="sessionDate"
  type="date"
  value={sessionDate}
  onChange={(e) => setSessionDate(e.target.value)}
  disabled={isPending}
  autoFocus
/>
```

```tsx
<RingsInput
  id="rings"
  name="rings"
  scoringType={effectiveScoringType}
  shotsPerSeries={shotsPerSeries}
  value={rings}
  onChange={(e) => setRings(e.target.value)}
  disabled={isPending}
/>
```

```tsx
<Input
  id="teiler"
  name="teiler"
  type="text"
  inputMode="decimal"
  placeholder="z.B. 3,7"
  value={teiler}
  onChange={(e) => setTeiler(e.target.value)}
  disabled={isPending}
/>
```

- [ ] **Step 3: Beim Schließen State zurücksetzen**

```tsx
function handleOpenChange(isOpen: boolean) {
  if (!isOpen) {
    setSessionDate(existingSeries?.sessionDate ?? new Date().toISOString().slice(0, 10))
    setRings(existingSeries ? String(existingSeries.rings) : "")
    setTeiler(existingSeries ? String(existingSeries.teiler) : "")
    setSelectedDisciplineId(initialDisciplineId)
  }
  setOpen(isOpen)
}
// <Dialog open={open} onOpenChange={handleOpenChange}>
```

- [ ] **Step 4: `/check`**

- [ ] **Step 5: Commit**

```bash
git add src/components/app/series/SeasonSeriesDialog.tsx
git commit -m "fix: preserve SeasonSeriesDialog values on validation error"
```

---

### Task 3: ParticipantForm — controlled Inputs

**Files:**

- Modify: `src/components/app/participants/ParticipantForm.tsx`

- [ ] **Step 1: Lokalen State**

```tsx
const [firstName, setFirstName] = useState<string>(participant?.firstName ?? "")
const [lastName, setLastName] = useState<string>(participant?.lastName ?? "")
const [contact, setContact] = useState<string>(participant?.contact ?? "")
```

- [ ] **Step 2: Inputs controlled machen**

```tsx
<Input
  id="firstName"
  name="firstName"
  value={firstName}
  onChange={(e) => setFirstName(e.target.value)}
  placeholder="z.B. Max"
  disabled={isPending}
/>
// analog für lastName, contact
```

- [ ] **Step 3: `/check`**

- [ ] **Step 4: Commit**

```bash
git add src/components/app/participants/ParticipantForm.tsx
git commit -m "fix: preserve ParticipantForm values on validation error"
```

---

### Task 4: DisciplineForm — controlled Inputs

**Files:**

- Modify: `src/components/app/disciplines/DisciplineForm.tsx`

- [ ] **Step 1: Lokalen State**

```tsx
const [name, setName] = useState<string>(discipline?.name ?? "")
const [scoringType, setScoringType] = useState<string>(discipline?.scoringType ?? "WHOLE")
const [teilerFaktor, setTeilerFaktor] = useState<string>(
  discipline?.teilerFaktor?.toString() ?? "1.0"
)
```

- [ ] **Step 2: Inputs/Select controlled machen**

```tsx
<Input
  id="name"
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="z.B. Luftpistole"
  disabled={isPending}
/>
```

```tsx
<Select
  name="scoringType"
  value={scoringType}
  onValueChange={setScoringType}
  disabled={isPending}
>
```

```tsx
<Input
  id="teilerFaktor"
  name="teilerFaktor"
  type="number"
  step="0.001"
  min="0.001"
  max="9.999"
  value={teilerFaktor}
  onChange={(e) => setTeilerFaktor(e.target.value)}
  placeholder="z.B. 0.333"
  disabled={isPending}
/>
```

- [ ] **Step 3: `/check`**

- [ ] **Step 4: Commit**

```bash
git add src/components/app/disciplines/DisciplineForm.tsx
git commit -m "fix: preserve DisciplineForm values on validation error"
```

---

### Task 5: UserCreateForm — controlled Inputs

**Files:**

- Modify: `src/components/app/users/UserCreateForm.tsx`

- [ ] **Step 1: Lokalen State**

```tsx
const [name, setName] = useState<string>("")
const [email, setEmail] = useState<string>("")
const [tempPassword, setTempPassword] = useState<string>("")
const [role, setRole] = useState<string>("USER")
```

- [ ] **Step 2: Inputs/Select controlled machen**

```tsx
<Input
  id="name"
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Vor- und Nachname"
  disabled={isPending}
/>
```

```tsx
<Input
  id="email"
  name="email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="nutzer@beispiel.de"
  disabled={isPending}
/>
```

```tsx
<Input
  id="tempPassword"
  name="tempPassword"
  type={showPassword ? "text" : "password"}
  value={tempPassword}
  onChange={(e) => setTempPassword(e.target.value)}
  placeholder="Mind. 12 Zeichen"
  disabled={isPending}
  className="pr-10"
/>
```

```tsx
<Select name="role" value={role} onValueChange={setRole} disabled={isPending}>
```

- [ ] **Step 3: `/check`**

- [ ] **Step 4: Commit**

```bash
git add src/components/app/users/UserCreateForm.tsx
git commit -m "fix: preserve UserCreateForm values on validation error"
```

---

### Task 6: UserEditForm — controlled Inputs

**Files:**

- Modify: `src/components/app/users/UserEditForm.tsx`

- [ ] **Step 1: Lokalen State**

```tsx
const [name, setName] = useState<string>(user.name ?? "")
const [email, setEmail] = useState<string>(user.email)
const [role, setRole] = useState<string>(user.role)
const [isActive, setIsActive] = useState<string>(user.isActive ? "true" : "false")
const [tempPassword, setTempPassword] = useState<string>("")
```

- [ ] **Step 2: Inputs/Select controlled machen**

```tsx
<Input
  id="name"
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Vor- und Nachname"
  disabled={isPending}
/>
```

```tsx
<Input
  id="email"
  name="email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  disabled={isPending}
/>
```

```tsx
<Select name="role" value={role} onValueChange={setRole} disabled={isPending}>
```

```tsx
<Select
  name="isActive"
  value={isActive}
  onValueChange={setIsActive}
  disabled={isPending}
>
```

```tsx
<Input
  id="tempPassword"
  name="tempPassword"
  type={showPassword ? "text" : "password"}
  value={tempPassword}
  onChange={(e) => setTempPassword(e.target.value)}
  placeholder="Leer lassen = kein Wechsel"
  disabled={isPending}
  className="pr-10"
/>
```

- [ ] **Step 3: `/check`**

- [ ] **Step 4: Commit**

```bash
git add src/components/app/users/UserEditForm.tsx
git commit -m "fix: preserve UserEditForm values on validation error"
```

---

### Task 7: AccountPasswordForm — controlled Inputs

**Files:**

- Modify: `src/components/app/account/AccountPasswordForm.tsx`

- [ ] **Step 1: Lokalen State**

```tsx
const [currentPassword, setCurrentPassword] = useState<string>("")
const [newPassword, setNewPassword] = useState<string>("")
const [confirmPassword, setConfirmPassword] = useState<string>("")
```

- [ ] **Step 2: Inputs controlled machen**

```tsx
<Input
  id="currentPassword"
  name="currentPassword"
  type={showCurrent ? "text" : "password"}
  value={currentPassword}
  onChange={(e) => setCurrentPassword(e.target.value)}
  disabled={isPending}
  className="pr-10"
/>
```

(analog für newPassword + confirmPassword)

- [ ] **Step 3: `/check`**

- [ ] **Step 4: Commit**

```bash
git add src/components/app/account/AccountPasswordForm.tsx
git commit -m "fix: preserve AccountPasswordForm values on validation error"
```

---

### Task 8: CompetitionForm — controlled Inputs

**Files:**

- Modify: `src/components/app/competitions/CompetitionForm.tsx`

Bereits controlled (bleiben unverändert): `type`, `scoringMode`, `allowGuests`, `teamSize`, `finalePrimary`, `finaleTiebreaker1`, `finaleTiebreaker2`, `finaleHasSuddenDeath`.

Umzustellen:

- [ ] **Step 1: Lokalen State für alle uncontrolled Felder**

```tsx
const [name, setName] = useState<string>(competition?.name ?? "")
const [shotsPerSeries, setShotsPerSeries] = useState<string>(
  String(competition?.shotsPerSeries ?? 10)
)
const [disciplineId, setDisciplineId] = useState<string>(competition?.disciplineId ?? "mixed")
const [minSeries, setMinSeries] = useState<string>(
  competition?.minSeries != null ? String(competition.minSeries) : ""
)
const [seasonStart, setSeasonStart] = useState<string>(toDateInputValue(competition?.seasonStart))
const [seasonEnd, setSeasonEnd] = useState<string>(toDateInputValue(competition?.seasonEnd))
const [hinrundeDeadline, setHinrundeDeadline] = useState<string>(
  toDateInputValue(competition?.hinrundeDeadline)
)
const [rueckrundeDeadline, setRueckrundeDeadline] = useState<string>(
  toDateInputValue(competition?.rueckrundeDeadline)
)
const [playoffBestOf, setPlayoffBestOf] = useState<string>(String(competition?.playoffBestOf ?? 5))
const [playoffHasViertelfinale, setPlayoffHasViertelfinale] = useState<boolean>(
  competition?.playoffHasViertelfinale ?? true
)
const [playoffHasAchtelfinale, setPlayoffHasAchtelfinale] = useState<boolean>(
  competition?.playoffHasAchtelfinale ?? false
)
const [eventDate, setEventDate] = useState<string>(toDateInputValue(competition?.eventDate))
const [teamScoring, setTeamScoring] = useState<string>(competition?.teamScoring ?? "SUM")
const [targetValue, setTargetValue] = useState<string>(
  competition?.targetValue != null ? String(competition.targetValue) : ""
)
const [targetValueType, setTargetValueType] = useState<string>(
  competition?.targetValueType ?? "RINGS"
)
```

- [ ] **Step 2: Alle Inputs/Selects controlled machen**

Beispiele (analog für alle anderen):

```tsx
<Input
  id="name"
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder={…}
  disabled={isPending}
/>
```

```tsx
<Input
  id="shotsPerSeries"
  name="shotsPerSeries"
  type="number"
  min={1}
  max={100}
  value={shotsPerSeries}
  onChange={(e) => setShotsPerSeries(e.target.value)}
  disabled={isPending}
/>
```

```tsx
<Select
  name="disciplineId"
  value={disciplineId}
  onValueChange={setDisciplineId}
  disabled={isPending || isEdit}
>
```

```tsx
<Input
  id="minSeries"
  name="minSeries"
  type="number"
  min={1}
  max={999}
  value={minSeries}
  onChange={(e) => setMinSeries(e.target.value)}
  placeholder="z.B. 20"
  disabled={isPending}
/>
```

(analog für `seasonStart`, `seasonEnd`, `hinrundeDeadline`, `rueckrundeDeadline`, `eventDate`)

```tsx
<Input
  id="playoffBestOf"
  name="playoffBestOf"
  type="number"
  min={1}
  max={9}
  step={2}
  value={playoffBestOf}
  onChange={(e) => setPlayoffBestOf(e.target.value)}
  placeholder="5"
/>
```

Für die zweite `shotsPerSeries`-Instanz im Liga-Block: gleichen State `shotsPerSeries` benutzen (es gibt nur einen Wert in der DB). Die `id` bleibt unterschiedlich (`shotsPerSeriesLeague`).

```tsx
<Input
  id="shotsPerSeriesLeague"
  name="shotsPerSeries"
  type="number"
  min={1}
  max={100}
  value={shotsPerSeries}
  onChange={(e) => setShotsPerSeries(e.target.value)}
/>
```

Native Checkboxes für `playoffHasViertelfinale` / `playoffHasAchtelfinale` controlled:

```tsx
<input
  id="playoffHasViertelfinale"
  name="playoffHasViertelfinale"
  type="checkbox"
  value="true"
  checked={playoffHasViertelfinale}
  onChange={(e) => setPlayoffHasViertelfinale(e.target.checked)}
/>
```

(analog für `playoffHasAchtelfinale`)

```tsx
<Select
  name="teamScoring"
  value={teamScoring}
  onValueChange={setTeamScoring}
  disabled={isPending}
>
```

```tsx
<Input
  id="targetValue"
  name="targetValue"
  type="number"
  step="0.1"
  min={0}
  value={targetValue}
  onChange={(e) => setTargetValue(e.target.value)}
  placeholder="z.B. 512"
  disabled={isPending}
/>
```

```tsx
<Select
  name="targetValueType"
  value={targetValueType}
  onValueChange={setTargetValueType}
  disabled={isPending}
>
```

- [ ] **Step 3: `/check`**

- [ ] **Step 4: Commit**

```bash
git add src/components/app/competitions/CompetitionForm.tsx
git commit -m "fix: preserve CompetitionForm values on validation error"
```

---

### Task 9: Final-Verification & Lessons

**Files:**

- Modify: `.claude/tasks/lessons.md`

- [ ] **Step 1: Final `/check`**

Alle Gates grün.

- [ ] **Step 2: Manuelle Browser-Verifikation (durch User)**

Pause für User-Test. Test-Szenarien:

1. Kranzl-Serie eintragen: Ringwert tippen, Teiler leer lassen, Speichern → Ringwert bleibt erhalten.
2. Saison-Serie eintragen: Datum + Ringe tippen, Teiler leer lassen, Speichern → Datum und Ringe bleiben erhalten.
3. Wettbewerb anlegen mit ungültigem Namen → andere Felder (Schusszahl, Disziplin, Datum) bleiben.
4. Nutzer anlegen mit ungültiger E-Mail → Name + Rolle bleiben.

- [ ] **Step 3: Lesson eintragen**

Nach erfolgreicher Verifikation in `.claude/tasks/lessons.md`:

```
| 2026-05-08 | React 19 setzt `<form action={fn}>` mit uncontrolled Inputs nach jedem Submit zurück — auch bei Validation Errors verlieren User Eingaben | Forms mit `useActionState`: Inputs IMMER controlled (`value` + `onChange` + lokaler State) |
```

- [ ] **Step 4: Commit**

```bash
git add .claude/tasks/lessons.md
git commit -m "docs: lesson on React 19 form action reset behavior"
```

---

## Self-Review Checklist (vom Plan-Author bereits durchgeführt)

- [x] **Spec coverage:** Alle 8 Forms im Spec haben einen Task.
- [x] **Placeholder scan:** Keine TBD/TODO in Steps; alle Code-Steps zeigen den vollständigen JSX-Snippet oder Mustern.
- [x] **Type consistency:** Alle State-Variablen sind `string` (oder `boolean` für native checkboxes), passend zu HTML form values.
- [x] **Konsistenz mit existierendem Pattern:** Folgt `ResultEntryDialog`-Stil.
