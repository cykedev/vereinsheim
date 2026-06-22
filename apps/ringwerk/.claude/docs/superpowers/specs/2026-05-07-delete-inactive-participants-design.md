# Design: Inaktive Teilnehmer löschen

**Datum:** 2026-05-07  
**Status:** Approved

---

## Ziel

Admins und Manager sollen inaktive Teilnehmer löschen können. Teilnehmer mit historischen Daten (Wettbewerbs-Einschreibungen, Serien) können nur von Admins per Force-Delete endgültig entfernt werden.

---

## Berechtigungen & Scope

| Aktion                                    | Berechtigung                      |
| ----------------------------------------- | --------------------------------- |
| Normales Löschen (keine Wettbewerbsdaten) | ADMIN + MANAGER                   |
| Force-Delete (mit historischen Daten)     | Nur ADMIN                         |
| Aktive Teilnehmer löschen                 | Nicht erlaubt — erst deaktivieren |

**Indikator für "historische Daten":** `_count.competitions > 0` (CompetitionParticipant-Einträge). Der Wert ist bereits in `getParticipantsForManagement` enthalten — kein zusätzlicher DB-Roundtrip.

---

## Daten-Layer

### Neue Server Action: `deleteParticipant(id, force)`

Datei: `src/lib/participants/actions.ts`

**Guards:**

1. Auth-Check: `canManage` für alle; `isAdmin` zusätzlich wenn `force=true`
2. Teilnehmer muss existieren
3. Teilnehmer muss `isActive === false` sein (Löschen aktiver Teilnehmer verboten)

**`force=false` (normales Löschen):**

- Prüft `db.competitionParticipant.count({ where: { participantId: id } })`
- `> 0` → Fehler: "Dieser Teilnehmer hat historische Daten. Force-Delete ist nur für Admins möglich."
- `=== 0` → `db.participant.delete({ where: { id } })`
- Audit-Log: `PARTICIPANT_DELETED`
- `revalidateParticipantPaths()` (bestehende Hilfsfunktion)

**`force=true` (Admin only — Kaskaden-Löschen in Transaktion):**

Reihenfolge Bottom-up (analog `forceDeleteCompetition`):

1. PlayoffMatches sammeln (participantAId = id OR participantBId = id)
2. PlayoffDuels für diese Matches sammeln
3. `PlayoffDuelResult` löschen (WHERE duelId IN ...)
4. `PlayoffDuel` löschen
5. `PlayoffMatch` löschen
6. Matchups sammeln (homeId = id OR awayId = id) — enthält auch Serien des Gegners
7. `Series` löschen (WHERE matchupId IN ...) — löscht Serien beider Teilnehmer für Liga-Paarungen
8. `Matchup` löschen
9. Restliche `Series` löschen (WHERE participantId = id) — Event/Saison-Serien
10. `CompetitionParticipant` löschen (WHERE participantId = id)
11. `Participant` löschen

`revalidateParticipantPaths()` nach der Transaktion.

Audit-Log **vor** der Transaktion schreiben (Teilnehmer existiert danach nicht mehr):

- Event: `PARTICIPANT_FORCE_DELETED`
- Details: `{ firstName, lastName, competitions: N, series: M }`

### Neue Audit-Events

Ergänzung in `src/lib/auditLog/types.ts` und `features.md`:

| Event                       | Auslöser                                  | competitionId |
| --------------------------- | ----------------------------------------- | ------------- |
| `PARTICIPANT_DELETED`       | Löschen ohne historische Daten            | null          |
| `PARTICIPANT_FORCE_DELETED` | Admin-Force-Delete mit historischen Daten | null          |

---

## UI

### `ParticipantRowActions` — neue Props

```ts
competitionsCount: number // aus _count.competitions
isAdmin: boolean // session.user.role === 'ADMIN'
```

### Trash-Button

- Icon: `Trash2` (wie beim Wettbewerbs-Force-Delete)
- Größe: `h-10 w-10` (Compliance-Rule)
- Erscheint **nur in inaktiven Zeilen** (der Button wird nicht gerendert wenn `isActive`)
- Variant: `ghost`

### Dialog-Varianten (adaptiv, basierend auf Props)

**Variante 1 — Kein Wettbewerbshistorie** (`competitionsCount === 0`):

AlertDialog mit einfacher Bestätigung:

- Titel: „Teilnehmer löschen?"
- Beschreibung: „{Nachname}, {Vorname} wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
- Buttons: Abbrechen | Löschen (destructive)

**Variante 2 — Historische Daten, kein Admin** (`competitionsCount > 0 && !isAdmin`):

AlertDialog mit Info-Meldung:

- Titel: „Löschen nicht möglich"
- Beschreibung: „Dieser Teilnehmer hat {N} Wettbewerbe und kann daher nicht gelöscht werden. Force-Delete ist nur für Admins möglich."
- Buttons: Schließen (nur Cancel)

**Variante 3 — Historische Daten, Admin** (`competitionsCount > 0 && isAdmin`):

AlertDialog mit Namens-Bestätigung (analog `ForceDeleteCompetitionSection`):

- Titel: „Teilnehmer endgültig löschen?"
- Beschreibung: Warnung über Datenverlust, inkl. Hinweis dass Liga-Paarungen des Teilnehmers und die zugehörigen Serien des Gegners ebenfalls gelöscht werden.
- Input: „Zur Bestätigung Nachnamen eingeben: **{Nachname}**"
- Löschen-Button aktiv nur wenn `confirmName.trim() === lastName`
- Buttons: Abbrechen | Endgültig löschen (destructive, disabled bis Name korrekt)

### Page (`/participants/page.tsx`)

Übergibt an `ParticipantRowActions` in der inaktiven Sektion:

- `isAdmin={session.user.role === "ADMIN"}`
- `competitionsCount={p._count.competitions}`

---

## Nicht im Scope

- Löschen aktiver Teilnehmer
- Gast-Datensätze (bereits automatisch bereinigt beim Abmelden)
- Bulk-Löschen mehrerer Teilnehmer gleichzeitig
