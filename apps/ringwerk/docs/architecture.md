# Architektur – Ringwerk

Verbindlich gleichrangig mit `docs/technical.md`. Neue Dateien immer gemäss dieser Struktur anlegen.

## Index

- [Routen](#routen)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Auth-Strategie](#auth-strategie)
- [Lib-Module](#lib-module)
- [Datenflussprinzip](#datenflussprinzip)

---

## Routen

```
/login                              ← öffentlich
/                                   ← Dashboard (LEAGUE: Tabelle + Playoffs; non-LEAGUE: EventRankingTable + Rangliste-Link)
/competitions                       ← alle Wettbewerbe
/competitions/new                   ← Wettbewerb anlegen (Admin)
/competitions/[id]                  ← Type-basierter Redirect (Liga → /schedule, Event → /ranking, Saison → /standings)
/competitions/[id]/participants     ← Teilnehmer einschreiben/verwalten (Admin)
/competitions/[id]/schedule         ← Spielplan + Tabelle (Liga); non-LEAGUE → Redirect zu /ranking
/competitions/[id]/standings        ← Ligatabelle (Liga) / Saison-Rangliste (Saison)
/competitions/[id]/ranking          ← Event-Rangliste
/competitions/[id]/series           ← Event/Saison Serien-Erfassung (Admin)
/competitions/[id]/playoffs         ← Playoff-Bracket (Liga, Admin)
/competitions/[id]/audit-log        ← Wettbewerb-Protokoll (nur Admin)
/participants                       ← Teilnehmerverwaltung
/participants/new                   ← Teilnehmer anlegen (Admin)
/participants/[id]                  ← Profil: alle Duelle, Ergebnisse, Statistik
/disciplines                        ← Disziplinverwaltung (Admin)
/disciplines/new                    ← Disziplin anlegen (Admin)
/disciplines/[id]/edit              ← Disziplin bearbeiten (Admin)
/admin/users                        ← Nutzerverwaltung (nur Admin)
/admin/users/new                    ← Nutzer anlegen (nur Admin)
/admin/users/[id]/edit              ← Nutzer bearbeiten (nur Admin)
/admin/audit-log                    ← Globales Protokoll (nur Admin)
/account                            ← Passwort ändern (eingeloggt)
/api/auth/[...nextauth]             ← NextAuth-Handler
/api/competitions/[id]/pdf/schedule  ← PDF-Export: Spielplan + Tabelle
/api/competitions/[id]/pdf/playoffs  ← PDF-Export: Playoff-Bracket
/api/competitions/[id]/pdf/ranking   ← PDF-Export: Event-Rangliste
/api/competitions/[id]/pdf/standings ← PDF-Export: Saison-Standings
/api/public/c/[slug]/pdf            ← Öffentliches PDF (Haupt-Artefakt des Wettbewerbs, 24h Cache)
```

---

## Verzeichnisstruktur

```
src/
  app/
    (public)/
      login/
        page.tsx
    (app)/
      layout.tsx              ← Auth-Guard + Navigation
      page.tsx                ← Dashboard
      competitions/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx                 ← Type-basierter Redirect
          edit/
            page.tsx
          participants/
            page.tsx
          schedule/
            page.tsx
          standings/
            page.tsx
          ranking/
            page.tsx               ← Event-Rangliste
          series/
            page.tsx               ← Event/Saison Serien-Erfassung
          playoffs/
            page.tsx
          audit-log/
            page.tsx
      participants/
        page.tsx
        new/
          page.tsx
        [id]/
          edit/
            page.tsx
      disciplines/
        page.tsx
        new/
          page.tsx
        [id]/
          edit/
            page.tsx
      admin/
        layout.tsx            ← Admin-Rolle erzwingen
        users/
          page.tsx
          new/
            page.tsx
          [id]/
            edit/
              page.tsx
        audit-log/
          page.tsx
      account/
        page.tsx
    api/
      auth/
        [...nextauth]/
          route.ts
      competitions/
        [id]/
          pdf/
            schedule/
              route.ts        ← PDF-Export: Spielplan + Tabelle
            playoffs/
              route.ts        ← PDF-Export: Playoff-Bracket
      public/
        c/
          [slug]/
            pdf/
              route.ts        ← Öffentliches PDF (resolveSlug, phase-aware, 24h Cache)
  components/
    ui/
      checkbox.tsx            ← shadcn/ui Checkbox
      rank-badge.tsx          ← gemeinsamer RankBadge (gold/silber/bronze/muted Pill, Props: rank: number)
    app/
      competitions/           ← Wettbewerbs-spezifische Komponenten, type badges
      competitionParticipants/ ← Einschreiben + Rückzug, isGuest/Disziplin-Support
      matchups/               ← Spielplan-Generierung + Anzeige
        BestOfEntryDialog.tsx ← Duel-für-Duel-Erfassung (Dialog), Stechschuss-UI, Match-Fortschritt (BEST_OF_SINGLE)
      results/                ← Ergebniserfassung (Dialog)
      standings/              ← Tabellenberechnung + Anzeige
        BestOfStandingsTable.tsx ← Tabelle für BEST_OF_SINGLE (Siege, Satzverhältnis, Satzdiff., bestes Erg.)
      playoffs/               ← Playoff-Bracket + Duell-Karten
      auditLog/               ← Protokoll-Liste (AuditLogList)
      events/                 ← Event-spezifische Komponenten
        EventSeriesDialog.tsx ← Serie hinzufügen/bearbeiten
        EventRankingTable.tsx ← Rangliste mit Disziplin + Faktor; `isMixed` prop zeigt "Teiler korr." bei gemischten Wettbewerben
        DeleteEventSeriesButton.tsx ← Serie löschen
      series/                 ← Saison-spezifische Komponenten
        SeasonSeriesDialog.tsx ← Serie hinzufügen/bearbeiten (sessionDate defaults zu heute, Disziplin-Vorauswahl, Dialog-Reopening-Fix)
        SeasonParticipantItem.tsx ← Collapsible Serien-Liste je Teilnehmer mit Chevron-Icon
        SeasonStandingsTable.tsx ← Saison-Rangliste mit sortierbaren Spalten (Ringe, Teiler, Ringteiler), `scoringMode`-basierte Default-Sortierung, `isMixed` zeigt "Best. Teiler korr."
        DeleteSeasonSeriesButton.tsx ← Serie löschen
      participants/
      disciplines/
      account/
      users/
      shared/                 ← wiederverwendbare App-Komponenten
      shell/                  ← Navigation, Providers
  lib/
    auth.ts                   ← NextAuth authOptions
    auth-helpers.ts           ← getAuthSession()
    auth-rate-limit/          ← Rate-Limiting-Modul
    authValidation.ts         ← E-Mail/Passwort-Validierung
    dateTime.ts               ← UTC/Timezone-Helfer (getDisplayTimeZone, formatDateOnly)
    db.ts                     ← Prisma-Client Singleton
    startup.ts                ← Erstinitialisierung (Admin + Disziplinen), aufgerufen aus root layout.tsx
    utils.ts                  ← cn() und andere UI-Helfer
    types.ts                  ← Shared Types (ActionResult etc.)
    competitions/
      actions.ts              ← Server Actions: Wettbewerb anlegen/bearbeiten/abschliessen/force-delete, Event/Saison-Felder (type, scoringMode, allowGuests, disciplineId, seasonStart/seasonEnd)
      queries.ts              ← Datenbankabfragen: Wettbewerb laden, getEventWithSeries, getSeasonWithSeries
      types.ts                ← CompetitionDetail, CompetitionListItem, Event/Saison-Typen
      publicSlug.ts           ← slugify, resolveSlug, findActiveSlugConflict (testpflichtig)
      publicSlug.test.ts
    competitionParticipants/
      actions.ts              ← Einschreiben, Rückzug, Rückzug rückgängig, isGuest + disciplineId Support
      queries.ts
      types.ts                ← isGuest, disciplineId Felder
    matchups/
      actions.ts              ← Spielplan generieren (Round-Robin + Best-of-Single)
      queries.ts              ← Paarungen laden, Schedule-Status
      generateSchedule.ts     ← Circle-Method-Algorithmus DOUBLE_ROUND_ROBIN (testpflichtig)
      generateSchedule.test.ts
      generateBestOfSchedule.ts ← Circle-Method-Algorithmus BEST_OF_SINGLE (einfache Runde; kein Heimrecht-Tausch)
      types.ts
    results/
      actions.ts              ← Ergebnis eintragen/korrigieren (DOUBLE_ROUND_ROBIN)
      bestOfActions.ts        ← saveBestOfDuel, saveStechschuss, deleteLatestBestOfDuel (BEST_OF_SINGLE)
      calculateResult.ts      ← Ringteiler-Berechnung, Outcome (testpflichtig)
      calculateResult.test.ts
      types.ts
    standings/
      queries.ts              ← Tabellendaten laden
      calculateStandings.ts   ← Tabellenberechnung DOUBLE_ROUND_ROBIN (Punkte, Direktvergleich, RT, testpflichtig)
      calculateStandings.test.ts
      calculateBestOfStandings.ts ← Tabellenberechnung BEST_OF_SINGLE (Siege, Direktvergleich, Satzdiff, bestes Erg.)
    scoring/
      calculateScore.ts       ← Kernfunktion für alle 7 Wertungsmodi
      calculateScore.test.ts
      rankParticipants.ts     ← Ranglistenberechnung pro Wertungsmodus
      rankParticipants.test.ts
      rankEventParticipants.ts ← Event-Ranking mit Faktor-Korrektur
      calculateSeasonStandings.ts ← Saison-Ranking (Bestwerte: beste Ringe, bester Teiler, bester Ringteiler; mit Mindestserien-Prüfung)
      bestOf.ts               ← duelOutcome, stechschussOutcome, resolveBestOf (Best-of-N Logik)
      types.ts                ← ScoringMode, ScoreInput, RankableEntry, RankedEntry, EventRankedEntry, SeasonRankedEntry
    series/
      actions.ts              ← saveEventSeries, deleteEventSeries, saveSeasonSeries, deleteSeasonSeries (mit Disziplin-Unterstützung)
      queries.ts              ← getSeasonSeries (lädt Serien einer Saison)
      types.ts                ← EventSeriesItem, SaveEventSeriesInput, SeasonSeriesItem, SaveSeasonSeriesInput
    playoffs/
      actions.ts              ← Playoffs starten, Duell-Ergebnis speichern, Duel anlegen
      queries.ts              ← Bracket-Daten laden
      calculatePlayoffs.ts    ← Bracket-Logik, Seeding, Match-Auflösung (testpflichtig)
      calculatePlayoffs.test.ts
      types.ts
    participants/
      actions.ts              ← Teilnehmer anlegen/bearbeiten
      queries.ts
      types.ts
    disciplines/
      actions.ts
      queries.ts
      systemDisciplines.ts    ← LP, LG, LPA, LGA Seed-Daten mit teilerFaktor
      types.ts
    users/
      actions.ts              ← Nutzer anlegen, bearbeiten, Passwort-Reset
      queries.ts
      types.ts
    auditLog/
      queries.ts              ← getAuditLogsByCompetition(), getAuditLogs() (globale Abfrage)
      types.ts                ← AuditEventType, AUDIT_EVENT_LABELS, formatAuditDetails()
    pdf/
      styles.ts               ← Gemeinsames StyleSheet + Farbkonstanten (react-pdf)
      SchedulePdf.tsx         ← PDF: Spielplan (Hin-/Rückrunde) + Tabelle (DOUBLE_ROUND_ROBIN)
      BestOfSchedulePdf.tsx   ← PDF: Spielplan mit Duell-Einzelergebnissen + Tabelle (BEST_OF_SINGLE)
      PlayoffsPdf.tsx         ← PDF: Playoff-Bracket-Ausdruck
      EventRankingPdf.tsx     ← PDF: Event-Rangliste (Kranzlschiessen)
      SeasonStandingsPdf.tsx  ← PDF: Saison-Standings (Bestwerte: Ringe, Teiler, Ringteiler)
  types/
    next-auth.d.ts            ← NextAuth Module Augmentation
  generated/
    prisma/                   ← auto-generiert via `prisma generate` — nie manuell editieren
```

---

## Auth-Strategie

**Next.js 16 verwendet `proxy.ts` statt `middleware.ts`** – die Datei-Konvention wurde umbenannt.
treffsicher (und damit auch diese App) nutzt **beide Schichten**:

1. **`src/proxy.ts`** – Edge-Level-Schutz via `withAuth` (next-auth); leitet nicht-eingeloggte Nutzer früh um
2. **Layout-basierte Guards** – zweite Absicherungsschicht, prüft Session zusätzlich im Layout

### `src/proxy.ts` – Edge-Auth (Next.js 16 Konvention)

```typescript
export const proxy = withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ req, token }) => {
      if (!token) return false
      if (req.nextUrl.pathname.startsWith("/admin")) return token.role === "ADMIN"
      return true
    },
  },
})
export default proxy

export const config = {
  matcher: ["/competitions/:path*", "/participants/:path*" /* ... */],
}
```

### Root Layout (`src/app/layout.tsx`)

- `export const dynamic = "force-dynamic"` – verhindert statisches Prerendering (Build ohne Live-DB möglich)
- Ruft `runStartup()` auf: legt Admin + Standard-Disziplinen beim ersten Start an (idempotent via `hasRun`-Flag)

### Route Groups

| Group         | Layout                                    | Schutz                    |
| ------------- | ----------------------------------------- | ------------------------- |
| `(public)`    | kein Auth-Check                           | Login-Seite               |
| `(app)`       | `getAuthSession()` → `redirect("/login")` | alle normalen Seiten      |
| `(app)/admin` | zusätzlich Rollen-Check                   | nur ADMIN (nicht MANAGER) |

**MANAGER vs. ADMIN:** MANAGER hat Zugang zu allen `(app)`-Seiten (Wettbewerbe, Teilnehmer, Disziplinen, Ergebnisse). Kein Zugang zu `(app)/admin` (Nutzerverwaltung). Force-Delete wird in Server Actions via Rollen-Check blockiert, nicht via Route.

### `(app)/layout.tsx` – Auth-Guard

```typescript
const session = await getAuthSession()
if (!session) redirect("/login")
```

### `(app)/admin/layout.tsx` – Rollen-Guard

```typescript
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"

const session = await getAuthSession()
if (!session) redirect("/login")
if (!canManage(session.user.role)) redirect("/") // ADMIN + MANAGER
// oder für Admin-only Pages:
if (!isAdmin(session.user.role)) redirect("/")
```

### In Server Actions

Immer in dieser Reihenfolge: **Auth → Rolle prüfen (falls nötig) → Validierung → DB**

```typescript
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"

const session = await getAuthSession()
if (!session) return { error: "Nicht angemeldet" }
if (!canManage(session.user.role)) return { error: "Keine Berechtigung" } // ADMIN + MANAGER
// oder für Admin-only Operationen (Hard-Deletes, Nutzerverwaltung):
if (!isAdmin(session.user.role)) return { error: "Keine Berechtigung" }
```

### `src/lib/startup.ts` – Erstinitialisierung

Wird vom Root-Layout bei jedem Request aufgerufen, führt aber nur einmal pro Prozess etwas aus:

1. Standard-Disziplinen anlegen (LP=0.333, LG=1.0, LPA=0.6, LGA=1.8 teilerFaktor) – falls noch nicht vorhanden
2. Admin-Account anlegen aus `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` – falls kein Admin existiert

---

## Lib-Module

Jedes Feature-Modul (`lib/<feature>/`) folgt diesem Muster:

| Datei           | Inhalt                                                |
| --------------- | ----------------------------------------------------- |
| `actions.ts`    | Server Actions (Auth → Validierung → DB)              |
| `queries.ts`    | Reine DB-Lesefunktionen (kein userId-Filter)          |
| `types.ts`      | Feature-spezifische TypeScript-Typen                  |
| `calculate*.ts` | Reine Berechnungsfunktionen (keine DB, testpflichtig) |

**Grössenregel:** Datei > 200 Zeilen → splitten in `actions/` oder `queries/` Unterordner mit Barrel-Export.

---

## Datenflussprinzip

```
Browser-Formular
  → useActionState(serverAction, null)
    → Server Action (lib/<feature>/actions.ts)
      → getAuthSession()          Auth
      → ZodSchema.safeParse()     Validierung
      → db.<model>.<op>()         DB (kein userId-Filter – vereinsweite Daten)
      → revalidatePath()          Cache invalidieren
      → return ActionResult       Strukturierte Rückgabe

Server Component (page.tsx)
  → lib/<feature>/queries.ts      Datenladen
  → Komponente rendern
```

**Kein Datenabruf in Client Components** – nur in Server Components oder via Server Actions.
