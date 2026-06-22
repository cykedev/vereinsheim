# Design: Disziplin-Änderung & Live-Teiler

**Datum:** 2026-05-23  
**Status:** Approved

---

## Überblick

Zwei unabhängige Features:

1. **Disziplin-Änderung** — Disziplin eines eingeschriebenen Teilnehmers nachträglich ändern, solange noch keine Serien erfasst wurden.
2. **Live-Teiler** — Korrigierten Teiler (Teiler × Faktor) live während der Ergebniserfassung anzeigen.

---

## Feature 1: Disziplin-Änderung

### Scope

- Nur **gemischte Wettbewerbe** (Liga, Event) — `competition.disciplineId === null`
- Nur **ACTIVE** eingeschriebene Teilnehmer
- Nur wenn **keine Serien** für diesen `CompetitionParticipant` existieren
- Nicht für Gastschützen (`isGuest = true`)
- Saison fällt heraus — Disziplin wird dort pro Serie gewählt, nicht pro CP

### Datenmodell-Änderungen

Kein Schema-Change. Nur Query und Type erweitert:

**`CompetitionParticipantListItem`** bekommt neues Feld:

```typescript
seriesCount: number
```

Befüllt via `_count: { select: { series: true } }` in `getCompetitionParticipants()`.

### Neue Server Action

```typescript
updateParticipantDiscipline(cpId: string, disciplineId: string): Promise<ActionResult>
```

Guards (in dieser Reihenfolge):

1. Auth + `canManage` — sonst `"Nicht angemeldet"` / `"Keine Berechtigung"`
2. CP existiert — sonst `"Einschreibung nicht gefunden."`
3. `status === "ACTIVE"` — sonst `"Disziplin kann nur bei aktiven Teilnehmern geändert werden."`
4. `seriesCount === 0` — sonst `"Disziplin kann nicht mehr geändert werden — es gibt bereits erfasste Serien."`
5. Disziplin existiert und ist nicht archiviert — sonst `"Disziplin nicht gefunden oder nicht verfügbar."`

Kein Audit-Log-Event (keine fachlich relevanten Daten berührt — reine Vorbereitung vor der ersten Serie).

`revalidatePath` für `/competitions/[id]/participants` und `/competitions`.

### UI — `CompetitionParticipantActions`

**Neue Prop:**

```typescript
disciplines?: SerializableDiscipline[]  // undefined = nicht gemischt oder nicht anwendbar
```

**Edit-Button** (Pencil-Icon, `h-10 w-10`, `title="Disziplin ändern"`):

Sichtbar wenn: `disciplines && !entry.isGuest && entry.status === "ACTIVE" && entry.seriesCount === 0`

**Dialog:**

- Titel: "Disziplin ändern"
- Subtitle: Teilnehmername
- Select mit allen verfügbaren Disziplinen (aktive, nicht-archivierte)
- Vorauswahl: aktuelle `entry.disciplineId`
- Buttons: Abbrechen / Speichern
- Bei Erfolg: Dialog schließen (via useTransition + toast bei Fehler)

**`participants/page.tsx`:**

- `disciplines` an `CompetitionParticipantActions` übergeben — nur wenn `isMixed`
- `seriesCount` kommt automatisch durch die erweiterte Query

### Tests

Neue Test-Cases in `competitionParticipants/actions.test.ts`:

| #   | Szenario                                         | Erwartetes Ergebnis             |
| --- | ------------------------------------------------ | ------------------------------- |
| 1   | Erfolg — gültige Disziplin, ACTIVE, keine Serien | `{ success: true }`, DB updated |
| 2   | seriesCount > 0                                  | Fehler: "Serien vorhanden"      |
| 3   | Status WITHDRAWN                                 | Fehler: "Nur ACTIVE"            |
| 4   | ungültige/archivierte DisciplineId               | Fehler: "nicht verfügbar"       |
| 5   | kein Auth                                        | Fehler: "Nicht angemeldet"      |

---

## Feature 2: Korrigierter Teiler live

### Scope

Alle drei Ergebniserfassungs-Dialoge:

- `EventSeriesDialog` (Event-Serien)
- `SeasonSeriesDialog` (Saison-Serien)
- `ResultEntryDialog` (Liga-Paarungen)

Anzeige nur wenn `teilerFaktor !== 1.0` und Teiler-Input eine gültige Zahl enthält.

### Keine Schema- oder Query-Änderungen

Rein client-seitiger Change.

### Neue/erweiterte Props

| Dialog               | Neue Props                                             |
| -------------------- | ------------------------------------------------------ |
| `EventSeriesDialog`  | `teilerFaktor?: number` (default: `1`)                 |
| `SeasonSeriesDialog` | `disciplines[].teilerFaktor: number` (Typ-Erweiterung) |
| `ResultEntryDialog`  | `homeTeilerFaktor: number`, `awayTeilerFaktor: number` |

### Berechnung & Anzeige (identisches Pattern in allen Dialogen)

```tsx
const teilerNum = parseFloat(teiler.replace(",", "."))
const correctedTeiler = isNaN(teilerNum) || teilerFaktor === 1.0 ? null : teilerNum * teilerFaktor

// Direkt unter dem Teiler-Input:
{
  correctedTeiler !== null && (
    <p className="text-xs text-muted-foreground">Korr. Teiler: {correctedTeiler.toFixed(2)}</p>
  )
}
```

**Saison-Besonderheit:** `teilerFaktor` wird aus der aktuell gewählten Disziplin abgeleitet — reagiert dynamisch auf Disziplin-Wechsel.

**Liga-Besonderheit:** Je ein Hint unter dem Teiler-Input von Heim und Gast, unabhängig voneinander.

### Pages als Datenlieferanten

**Event (`series/page.tsx`):**

```tsx
teilerFaktor={
  (cp.discipline ?? competition.discipline)?.teilerFaktor ?? 1
}
```

**Saison (`SeasonParticipantItem` via `series/page.tsx`):**

`allDisciplines` aus `getDisciplines()` enthält `teilerFaktor` bereits — Typ-Erweiterung in `SeasonSeriesDialog` reicht.

**Liga (`schedule/page.tsx`):**

Discipline/Faktor pro Teilnehmer aus den bestehenden Matchup-Daten ableiten:
`homeTeilerFaktor` und `awayTeilerFaktor` aus `cp.discipline?.teilerFaktor ?? competition.discipline?.teilerFaktor ?? 1`.

### Tests

Keine neuen Unit-Tests — die Berechnung `teiler * faktor` ist trivial und rein visuell. Bestehende Tests bleiben unverändert.

---

## Implementierungs-Reihenfolge

Feature 1 und Feature 2 sind unabhängig und können parallel implementiert werden.

### Feature 1 (Layer-Reihenfolge)

1. Types — `seriesCount` zu `CompetitionParticipantListItem`
2. Queries — `_count` in `getCompetitionParticipants`
3. Actions — `updateParticipantDiscipline` + Tests
4. Components — `CompetitionParticipantActions` (neuer Button + Dialog)
5. Page — `participants/page.tsx` (disciplines übergeben)

### Feature 2 (Layer-Reihenfolge)

1. Components — `EventSeriesDialog`, `SeasonSeriesDialog`, `ResultEntryDialog` (Props + Live-Hint)
2. Pages — `series/page.tsx`, `schedule/page.tsx` (neue Props übergeben)

---

## Nicht im Scope

- Saison: keine CP-Disziplin-Änderung (Disziplin ist per Serie, nicht per CP)
- Audit-Log-Event für Disziplin-Änderung (keine fachlich relevanten Daten berührt)
- Änderung der Disziplin bei zurückgezogenen Teilnehmern
- Änderung wenn bereits Serien vorhanden (strikte Guard)
