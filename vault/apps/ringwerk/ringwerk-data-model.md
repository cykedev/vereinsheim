---
id: ringwerk-data-model
type: guide
title: "Ringwerk — Datenmodell & Glossar – Ringwerk"
aliases: ["Datenmodell & Glossar – Ringwerk"]
keywords: [ringwerk, datenmodell, glossar, ringwerk]
part_of: ["[[ringwerk]]"]
---

**TL;DR** E-Mail, Passwort (bcrypt), Rolle (ADMIN | MANAGER | USER), Status

# Datenmodell & Glossar – Ringwerk

---

## Kernentitaeten (Zielzustand)

### Benutzer (User)

- E-Mail, Passwort (bcrypt), Rolle (ADMIN | MANAGER | USER), Status
- Vereinsweite Daten — kein userId-Filter auf Fachdaten
- MANAGER: kann Wettbewerbe, Ergebnisse, Teilnehmer und Disziplinen verwalten; kein Zugriff auf Nutzerverwaltung (/admin/) und Force-Delete

**Hinweis:** Das "W" in Wettbewerb wird immer groß geschrieben.

### Disziplin (Discipline)

- Name, Kuerzel, Wertungsart (WHOLE | DECIMAL), Max.Ringe/Schuss
- **teilerFaktor: Decimal (default 1.0)** — Korrekturfaktor fuer gemischte Wertungen
- Status: aktiv | archiviert
- Systemdisziplinen: LP (0.333), LG (1.0), LPA (0.6), LGA (1.8)

### Wettbewerb (Competition) — ersetzt League

- **type: CompetitionType** (LEAGUE | EVENT | SEASON) — bestimmt Verhalten und UI
- Name, Status (DRAFT | ACTIVE | COMPLETED | ARCHIVED)
- **scoringMode: ScoringMode** — primärer Wertungsmodus (bei Liga: Gruppenphase)
- **shotsPerSeries: Int (default 10)** — Schusszahl pro Serie
- **disciplineId: String?** — null = gemischte Disziplinen (Faktor-Korrektur aktiv)
- Typ-spezifische Felder (nullable, nur relevant für jeweiligen Typ):
- **liga, event, saison: String?** — externe Referenzen zur Registrierung (optional, für Audit)

#### Liga-spezifisch (LEAGUE)

| Feld                    | Typ          | Default            | Beschreibung                                                                                                        |
| ----------------------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| roundDeadlineHin        | DateTime?    | null               | Stichtag Hinrunde                                                                                                   |
| roundDeadlineRueck      | DateTime?    | null               | Stichtag Rückrunde                                                                                                  |
| groupScoringMode        | ScoringMode? | RINGTEILER         | Wertungsmodus Gruppenphase (= scoringMode)                                                                          |
| playoffBestOf           | Int?         | 3                  | Siege zum Weiterkommen VF/HF (3 = Best-of-Five)                                                                     |
| playoffHasViertelfinale | Boolean      | true               | Viertelfinale aktiv (Top 8, 4 Paarungen)                                                                            |
| playoffHasAchtelfinale  | Boolean      | false              | Achtelfinale aktiv (Top 16, 8 Paarungen); überschreibt VF-Flag                                                      |
| playoffQualThreshold    | Int?         | 8                  | Ab dieser TN-Zahl → Viertelfinale                                                                                   |
| playoffQualTopN1        | Int?         | 4                  | Qualifikanten für HF bei Direkteinstieg                                                                             |
| playoffQualTopN2        | Int?         | 8                  | Qualifikanten für VF                                                                                                |
| finalePrimary           | ScoringMode  | RINGS              | Hauptkriterium Finale (Pflicht); Default: nur Ringe, höchste gewinnt                                                |
| finaleTiebreaker1       | ScoringMode? | null               | Tiebreaker-Kriterium 1 bei Gleichstand (optional)                                                                   |
| finaleTiebreaker2       | ScoringMode? | null               | Tiebreaker-Kriterium 2 bei weiterem Gleichstand (optional)                                                          |
| finaleHasSuddenDeath    | Boolean?     | true               | Sudden Death nach allen Kriterien noch Gleichstand                                                                  |
| leagueFormat            | LeagueFormat | DOUBLE_ROUND_ROBIN | Spielplan-Format (Doppelrunde oder Einfachrunde Best-of-N)                                                          |
| groupBestOf             | Int?         | 3                  | N in Best-of-N (muss ungerade sein); benötigte Siege = ceil(N/2)                                                    |
| groupPlayAllDuels       | Boolean      | false (DB)         | Alle N Duelle immer austragen, kein vorzeitiger Abbruch; im Formular/Standard für BEST_OF_SINGLE auf true vorbelegt |
| groupTiebreaker1        | ScoringMode? | null               | Optionaler Override: sekundäres Kriterium bei Duel-Wert-Gleichstand statt Stechschuss                               |
| groupTiebreaker2        | ScoringMode? | null               | Optionaler Override: tertiäres Kriterium bei weiterem Gleichstand                                                   |
| groupHasSuddenDeath     | Boolean      | true               | true = Stechschuss bei Paarungs-Gleichstand (Standard); false = Wiederholungsduell                                  |

#### Event-spezifisch (EVENT)

| Feld            | Typ              | Default | Beschreibung                                                |
| --------------- | ---------------- | ------- | ----------------------------------------------------------- |
| eventDate       | DateTime?        | null    | Veranstaltungsdatum                                         |
| allowGuests     | Boolean?         | false   | Gastteilnehmer erlaubt                                      |
| teamSize        | Int?             | null    | null = Einzel; 2+ = Teamgrösse (Anzahl Mitglieder/Team)     |
| teamScoring     | TeamScoring?     | null    | SUM = Summe; BEST = Bestes; nur wenn teamSize >= 2          |
| targetValue     | Decimal?         | null    | Zielwert (nur TARGET_ABSOLUTE / TARGET_UNDER / TARGET_OVER) |
| targetValueType | TargetValueType? | null    | TEILER, RINGS oder RINGS_DECIMAL                            |

#### Saison-spezifisch (SEASON)

| Feld        | Typ       | Default | Beschreibung                      |
| ----------- | --------- | ------- | --------------------------------- |
| minSeries   | Int?      | 20      | Mindestanzahl Serien fuer Wertung |
| seasonStart | DateTime? | null    | Saisonbeginn                      |
| seasonEnd   | DateTime? | null    | Saisonende                        |

### Wettbewerbs-Teilnehmer (CompetitionParticipant) — ersetzt LeagueParticipant

- competitionId, participantId
- **disciplineId: String?** — individuelle Disziplinwahl bei gemischten Wettbewerben; null bei disziplin-gebundenen
- startNumber: Int?
- status: ACTIVE | WITHDRAWN
- **isGuest: Boolean (default false)** — Gastteilnehmer bei Events; wird in der Event-Rangliste als "Gast"-Badge angezeigt
- **eventTeamId: String?** — Team-Zugehörigkeit bei Team-Events (FK auf EventTeam)
- withdrawalReason, withdrawnAt, withdrawalDate

**Doppel-Einschreibung:** Bei Team-Events kann ein Teilnehmer mehrere CP-Records haben (je einen pro Team). Eindeutigkeit wird über zwei partielle Unique-Indizes erzwungen: `cp_unique_individual` (WHERE eventTeamId IS NULL) und `cp_unique_team` (WHERE eventTeamId IS NOT NULL).

### Team im Event (EventTeam)

- **id: String** — eindeutige Team-ID
- **competitionId: String** — Wettbewerb (FK)
- **teamNumber: Int** — fortlaufende Nummer (1, 2, 3, …) innerhalb des Wettbewerbs
- **members: CompetitionParticipant[]** — Teilnehmer dieses Teams

**Design:** Nur für `type=EVENT` mit `teamSize >= 2`. Teams haben keine Bezeichnung, nur Nummern. Teams entstehen beim Einschreiben und werden automatisch gelöscht wenn alle Mitglieder abgemeldet werden.

### Teilnehmer (Participant)

- Name, Vorname, Kontaktmoeglichkeit (E-Mail oder Telefon, optional)
- Status: aktiv | inaktiv
- Kann in mehreren Wettbewerben eingeschrieben sein
- **isGuestRecord: Boolean (default false)** — Markiert stille Gast-Datensätze; nicht sichtbar in der Teilnehmerverwaltung
- Gast-Datensätze werden automatisch gelöscht, wenn der Gast aus einem Event abgemeldet wird

### Serie (Series) — ersetzt MatchResult

Universelle Ergebniseinheit für alle Wettbewerbstypen:

- **competitionParticipantId: String? (FK)** — Zuordnung zur konkreten Einschreibung (Pflicht für neue Serien bei Events; null nur bei Legacy-Serien). Disambiguiert Doppel-Enrollment bei Team-Events.
- **disciplineId: String (FK)** — geschossene Disziplin (wichtig bei gemischten Wettbewerben)
- **rings: Decimal** — Gesamtringe der Serie; bei Stechschuss-Runden: der einzelne Dezimalwert des Schusses
- **teiler: Decimal** — bester Teiler der Serie; bei Stechschuss-Runden: 0 (ungenutzt)
- **shots: Decimal[]?** — Einzelschusswerte (Pflicht bei DECIMAL_REST-Modus in LEAGUE; optional sonst)
- **shotCount: Int** — Anzahl Schüsse (default aus Competition.shotsPerSeries); bei Stechschuss-Runden: 1
- **sessionDate: DateTime** — Schießdatum (relevant für Saison-Modus)
- **matchupId: String? (FK)** — nur bei Liga: Verknüpfung zur Paarung
- **isGuest: Boolean (default false)** — Hilfsflag für Event-Rangliste (denormalisiert aus CompetitionParticipant.isGuest)
- **duelNumber: Int?** — BEST_OF_SINGLE: 1..N für reguläre Duelle, > N für Stechschuss-Runden; DOUBLE_ROUND_ROBIN: immer 1; Event/Saison: null. Unique-Constraint: `@@unique([matchupId, participantId, duelNumber])` (NULL-Werte sind per SQL-Standard distinct).
- **isTiebreak: Boolean (default false)** — true = Stechschuss-Runde; `shots` und `teiler` sind ungenutzt (0), `rings` enthält den einzelnen Dezimal-Schusswert

### Paarung (Matchup) — nur Liga

- competitionId, roundIndex, homeId, awayId, status
- Unveraendert gegenueber bisherigem Modell (nur FK-Referenz Competition statt League)

### Playoff-Strukturen — nur Liga

- PlayoffMatch, PlayoffDuel, PlayoffDuelResult
- Unveraendert gegenueber bisherigem Modell (nur FK-Referenz Competition statt League)

### Audit-Log

- Wie bisher, aber `leagueId` wird zu `competitionId`
- Neue Ereignistypen für Event und Saison nach Bedarf
- `AuditLog.competitionId` ist die zentrale FK zur Competition

---

## Enums (Zielzustand)

### CompetitionType (NEU)

```
LEAGUE    – Liga mit Spielplan, Tabelle, Playoffs
EVENT     – Einmaliges Event (Kranzlschiessen)
SEASON    – Langzeit-Wettbewerb (Jahrespreisschiessen)
```

### ScoringMode (NEU)

```
RINGTEILER       – MaxRinge - Ringe + (Teiler * Faktor); niedrigster gewinnt
RINGS            – Gesamtringe (ganzzahlig); hoechster gewinnt
RINGS_DECIMAL    – Gesamtringe (Zehntelwertung); hoechster gewinnt
TEILER           – Teiler * Faktor; niedrigster gewinnt
DECIMAL_REST     – Nachkommastelle der Ringe summiert; hoechster gewinnt
TARGET_ABSOLUTE  – Abweichung vom Zielwert; geringste gewinnt (nur EVENT)
TARGET_UNDER     – ≤ Zielwert bevorzugt, dann Abweichung; geringste gewinnt (nur EVENT)
TARGET_OVER      – >= Zielwert bevorzugt, dann Abweichung; geringste gewinnt (nur EVENT)
```

### TeamScoring (nur bei Event mit teamSize >= 2)

```
SUM  – Teamergebnis = Summe der Einzelergebnisse aller Mitglieder
BEST – Teamergebnis = bestes Einzelergebnis im Team
```

### TargetValueType (NEU, nur bei TARGET-Modi)

```
TEILER          – Zielwert bezieht sich auf den (korrigierten) Teiler
RINGS           – Zielwert bezieht sich auf Gesamtringe (ganzzahlig)
RINGS_DECIMAL   – Zielwert bezieht sich auf Gesamtringe (Zehntelwertung)
```

### CompetitionStatus (ersetzt LeagueStatus)

```
DRAFT       – in Vorbereitung (noch nicht gestartet)
ACTIVE      – laufend
COMPLETED   – abgeschlossen
ARCHIVED    – archiviert
```

**Hinweis:** DRAFT ist das neue Status-Feld, das für alle Wettbewerbstypen beim Erstellen gesetzt wird.

### LeagueFormat (NEU)

```
DOUBLE_ROUND_ROBIN  – Standard-Liga: Hin- und Rückrunde (jeder gegen jeden zweimal)
BEST_OF_SINGLE      – Einfachrunde: Jeder gegen jeden einmal, jede Begegnung als Best-of-N
```

### Bestehende Enums (unveraendert)

- ScoringType: WHOLE | DECIMAL (Disziplin-Wertungsart)
- ParticipantStatus: ACTIVE | WITHDRAWN
- MatchupStatus: PENDING | COMPLETED | BYE | WALKOVER
- PlayoffRound: EIGHTH_FINAL | QUARTER_FINAL | SEMI_FINAL | FINAL
- Role: ADMIN | MANAGER | USER
- ImportSource: MANUAL | URL | PDF

---

## Berechnungsregeln

### Faktor-Korrektur

```
korrigierterTeiler = Teiler * Disziplin.teilerFaktor
```

- LG freihand: Faktor 1.0 → Teiler unverändert
- LP freihand: Faktor 0.333 → Teiler / 3
- LG Auflage: Faktor 1.8 → Teiler \* 1.8
- LP Auflage: Faktor 0.6 → Teiler \* 0.6 (= 1.8 \* 0.333)
- Faktor ist frei konfigurierbar pro Disziplin

**Faktor greift nur bei gemischter Disziplin** (`Competition.disciplineId === null`). Bei fester Disziplin (`disciplineId !== null`) ist der effektive Faktor **1.0** — der Teiler bleibt unverändert. Maßgeblich ist die **Competition**-`disciplineId`, nicht die aufgelöste Teilnehmer-Disziplin. Zentral implementiert in `effectiveTeilerFaktor(competitionDisciplineId, faktor)` (`src/lib/scoring/calculateScore.ts`); alle Persistenz-Actions, Ranking-Funktionen und Live-UI-Hints ziehen den Faktor durch diese Funktion.

### Wertungsmodus: RINGTEILER

```
Ringteiler = MaxRinge − Ringe + (Teiler * Faktor)
```

- MaxRinge: 100 (WHOLE) | 109 (DECIMAL)
- Niedrigerer Ringteiler gewinnt
- Bei gemischten Disziplinen gleicht der Faktor die Teiler-Unterschiede aus

Beispiel (gemischt): LG-Schuetze: 96 Ringe, Teiler 3.7, Faktor 1.0 → RT = 100 - 96 + 3.7 = 7.7
LP-Schuetze: 88 Ringe, Teiler 18.0, Faktor 0.333 → RT = 100 - 88 + 6.0 = 18.0 ... Nein:
LP: RT = 100 - 88 + (18.0 \* 0.333) = 100 - 88 + 6.0 = 18.0

### Wertungsmodus: RINGS / RINGS_DECIMAL

```
Wert = Gesamtringe
```

- RINGS: ganzzahlig, max 100 (bei 10 Schuss)
- RINGS_DECIMAL: Zehntelwertung, max 109.0 (bei 10 Schuss)
- Höchster Wert gewinnt
- Kein Faktor beteiligt

### Wertungsmodus: TEILER

```
Wert = Teiler * Faktor
```

- Niedrigster Wert gewinnt
- Faktor-Korrektur aktiv bei gemischten Disziplinen

### Wertungsmodus: DECIMAL_REST

```
Wert = Summe der Nachkommastellen aller Ringe
```

- Beispiel: Bei Ringwerten 9.5, 10.2, 8.7 → 0.5 + 0.2 + 0.7 = 1.4
- Höchster Wert gewinnt
- Kein Faktor beteiligt
- Erfordert Einzelschusswerte (nicht nur Gesamtringe)
- **Nur in LEAGUE verfügbar** — EVENT und SEASON können DECIMAL_REST nicht verwenden (individuelle Schusswerte sind dort bei Event optional und bei Saison nicht dokumentiert)

### Wertungsmodus: TARGET_ABSOLUTE (nur EVENT)

```
Abweichung = |Messwert − Zielwert|
```

- Messwert = je nach targetValueType: Ringe, Teiler\*Faktor, oder Ringe (Zehntel)
- Geringste Abweichung gewinnt
- Bei Teiler-basiertem Zielwert: Faktor-Korrektur auf den Messwert, Zielwert ist im korrigierten Raum

### Wertungsmodus: TARGET_UNDER (nur EVENT)

```
Abweichung = Messwert − Zielwert
```

Ranking-Logik (zweistufig):

1. Alle Teilnehmer mit Messwert ≤ Zielwert, sortiert nach geringster Abweichung (nächster am Ziel gewinnt)
2. Alle Teilnehmer mit Messwert > Zielwert, sortiert nach geringster Abweichung

Ergebnis: Wer über dem Ziel liegt, kommt immer nach allen die darunter oder gleich sind.

### Wertungsmodus: TARGET_OVER (nur EVENT)

```
Abweichung = Zielwert − Messwert
```

Ranking-Logik (zweistufig):

1. Alle Teilnehmer mit Messwert ≥ Zielwert, sortiert nach geringster Abweichung (nächster am Ziel gewinnt)
2. Alle Teilnehmer mit Messwert < Zielwert, sortiert nach geringster Abweichung

Ergebnis: Wer unter dem Ziel liegt, kommt immer nach allen die drüber oder gleich sind.

### Liga-spezifisch: Punktevergabe (Gruppenphase)

| Ergebnis      | Sieger   | Verlierer |
| ------------- | -------- | --------- |
| Sieg          | 2 Punkte | 0 Punkte  |
| Kampflos-Sieg | 2 Punkte | 0 Punkte  |
| Unentschieden | 1 Punkt  | 1 Punkt   |
| Freilos       | 2 Punkte | —         |

### Liga-spezifisch: Unentschieden-Aufloesung

1. Bessere Serie (hoehere Ringsumme) → 2 Punkte
2. Besserer Teiler (kleinerer Wert, ggf. mit Faktor) → 2 Punkte
3. Kein Gewinner moeglich → beide 1 Punkt (DRAW)

### Liga-spezifisch: Tabellensortierung (DOUBLE_ROUND_ROBIN)

1. Punkte (absteigend)
2. Direkter Vergleich bei Punktgleichstand
3. Bestes individuelles Ergebnis (niedrigster Ringteiler aus allen Gruppenspielen)

### Liga-spezifisch: BEST_OF_SINGLE — Duel-Auflösung

Jede Begegnung besteht aus N Duellen (groupBestOf, default 3). Pro Duell schießt jeder Teilnehmer eine Serie. Der Gewinner eines Duells wird durch `duelOutcome` ermittelt:

1. Primär: scoringMode (RINGTEILER, RINGS, RINGS_DECIMAL, TEILER …)
2. Optional groupTiebreaker1, dann groupTiebreaker2

Ergebnis ist immer A, B oder TIE. Bei TIE zählt das Duell für keinen Seite. Keine Zeichenergebnis auf Begegnungsebene — nach N Duellen muss ein Stechschuss entscheiden.

**Match-Auflösung via `resolveBestOf`:**

- `playAll=true` (Standard für BEST_OF_SINGLE): alle N Duelle werden immer gespielt
- Gewinner = wer nach N Duellen mehr Duelle gewonnen hat
- Bei Gleichstand nach N Duellen → Stechschuss-Runden (`isTiebreak=true`): entschieden durch einzelnen Dezimalschuss, höherer Wert gewinnt (unabhängig von scoringMode). Erste nicht-gleichwertige Runde entscheidet.
- Stechschuss-duelNumbers werden ab maxRegularDuel+1 aufwärts vergeben.

### Liga-spezifisch: BEST_OF_SINGLE — Tabellensortierung

Nur tabellensichtbare Kriterien (kein direkter Vergleich), Spaltenreihenfolge = Bewertungsreihenfolge:

1. Siege (Begegnungssiege, absteigend)
2. Satzdifferenz (duelsWon − duelsLost, absteigend)
3. Mehr gewonnene Sätze (duelsWon, absteigend)
4. Bestes Einzelergebnis (bei RINGS/RINGS_DECIMAL: höchste Ringe; sonst: niedrigster Ringteiler)
5. Nachname (Stabilisierung)

Ein per Stechschuss entschiedenes Gleichstands-Duell zählt für den Stechschuss-Sieger (Best-of-3 endet so z. B. 2:1, nicht 1:1). 5. Nachname alphabetisch (de)

### Saison-spezifisch: Mehrfach-Wertung

Pro Teilnehmer werden drei Bestwerte ermittelt (jeweils aus einer einzelnen Serie):

- **Beste Ringe:** Serie mit höchster Ringzahl
- **Bester Teiler:** Serie mit niedrigstem korrigierten Teiler (Teiler \* Faktor)
- **Bester Ringteiler:** Serie mit niedrigstem Ringteiler (MaxRinge - Ringe + Teiler\*Faktor)

Wichtig: Beste Ringe und bester Teiler können aus **verschiedenen Serien** stammen. Ringteiler muss aus **derselben Serie** stammen (Ringe und Teiler gehören zusammen).

Nur Teilnehmer mit ≥ minSeries Serien werden gewertet.

---

## Glossar

| Begriff                     | Erklärung                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Serie                       | Ergebnis eines Schießdurchgangs: N Schuss (default 10), erfasst als Gesamtringe + bester Teiler + Disziplin    |
| Teiler                      | Abstand Einschuss zur Scheibenmitte als Dezimalwert (z.B. 25.7); kleinerer Wert = näher an der Mitte           |
| Teiler-Faktor               | Korrekturfaktor pro Disziplin; gleicht unterschiedliche Schwierigkeitsgrade aus (z.B. LP /3, LG Auflage \*1.8) |
| Korrigierter Teiler         | Teiler \* Faktor; Basis für fairen Vergleich bei gemischten Disziplinen                                        |
| Ringteiler                  | MaxRinge − Ringe + (Teiler \* Faktor); je kleiner, desto besser                                                |
| Wettbewerb (Competition)    | Oberbegriff für Liga, Event und Saison                                                                         |
| Liga (LEAGUE)               | Rundenbasierter Wettbewerb mit Spielplan, Tabelle, Playoffs                                                    |
| Event (EVENT)               | Einmaliges Schießen (z.B. Kranzl); Rangliste aus einer Serie pro Teilnehmer; optional mit Team-Wertung         |
| Team im Event (EventTeam)   | Mehrere Schützen als Team; Teamergebnis = Summe oder Bestes der Mitglieder; kein Teamname, nur Nummer          |
| Saison (SEASON)             | Langzeit-Wettbewerb; viele Serien über Monate, beste Einzelserien zählen                                       |
| Wertungsmodus (ScoringMode) | Bestimmt wie Ergebnisse verglichen/gereiht werden (7 Modi)                                                     |
| Zielwert                    | Vorgabewert bei TARGET-Modi; Teilnehmer schießen möglichst nah daran                                           |
| Ganzring-Disziplin          | Ringe ganzzahlig 0–10; Max. 100/Serie bei 10 Schuss (z.B. LP freistehend)                                      |
| Zehntelring-Disziplin       | Ringe 0.0–10.9; Max. 109/Serie bei 10 Schuss (z.B. LG Auflage)                                                 |
| Heimrecht                   | Erstgenannter Schütze in einer Liga-Paarung organisiert Termin (nur DOUBLE_ROUND_ROBIN)                        |
| Round Robin                 | Jeder gegen jeden (Hin- und Rückrunde); nur DOUBLE_ROUND_ROBIN-Liga                                            |
| Best-of-N (Gruppenphase)    | BEST_OF_SINGLE: jede Begegnung besteht aus N Duellen; wer mehr gewinnt, siegt in der Begegnung                 |
| Duell                       | Einzelne Schiess-Runde innerhalb einer BEST_OF_SINGLE-Begegnung; duelNumber 1..N                               |
| Stechschuss                 | Einzelner Dezimalschuss zur Entscheidung bei Gleichstand nach N Duellen; isTiebreak=true; höherer Wert gewinnt |
| Satzverhältnis              | duelsWon:duelsLost in der BEST_OF_SINGLE-Tabelle                                                               |
| Satzdifferenz               | duelsWon − duelsLost (duelDiff) in der BEST_OF_SINGLE-Tabelle                                                  |
| Freilos                     | Kampfloser Sieg bei ungerader Teilnehmerzahl (2 Punkte); nur Liga                                              |
| Rückzug                     | Vorzeitiges Ausscheiden; alle Ergebnisse rückwirkend gestrichen                                                |
| Best-of-Five                | VF/HF-Format: wer zuerst 3 Duelle gewinnt, kommt weiter; konfigurierbar                                        |
| Finale-Modus                | Sondermodus im Liga-Finale; Wertung als Kriterien-Kette (Primary + optional 2 Tiebreaker); Default: nur Ringe  |
| Gastteilnehmer              | Nicht-Vereinsmitglied; kann an Events teilnehmen; isGuest-Flag                                                 |
| Mindestserien               | Saison: Anzahl Serien die ein Teilnehmer mindestens geschossen haben muss                                      |
| Meyton-Import               | Ergebnisübernahme aus Meyton-System via URL oder PDF                                                           |
| Vorschiessen                | Nicht erlaubt in Liga — beide Schützen müssen gleichzeitig am Stand antreten                                   |

## Aus Lernlog übernommen

<!-- Zuletzt konsolidiert: 2026-06-23 -->

- **Sperr-Granularität an den Wirkungs-Zeitpunkt koppeln**: Eine Einstellung erst ab dem Zeitpunkt sperren, ab dem sie _wirkt_, nicht ab "irgendwelche Daten existieren". Gruppenphase/Format gesperrt ab `matchupCount > 0`; Playoff/Finale-Wahl erst ab `hasPlayoffsStarted` (`playoffMatch.count > 0`). Eine zu grobe Sperre erzeugt Deadlocks (z.B. Bracket-Wahl bei zu wenigen Teilnehmern nicht mehr korrigierbar, Playoffs starten aber auch nicht).
- **Stechschuss-Tiebreak über eigenes Maß auflösen**: Den Einzelschuss-Stichentscheid immer über `stechschussOutcome(homeShot, awayShot)` (höherer Schusswert gewinnt) auflösen, nie über `duelOutcome(scoringMode)` — im TEILER-Modus (Stechschuss-Teiler = 0) liefert der scoringMode-Weg immer TIE und löst nie auf. Dieselbe Funktion konsistent in Action, Standings und PDF nutzen.
- **`targetValueType` hat bei TARGET-Modi Vorrang vor der Disziplin**: Bei `scoringMode = TARGET_*` bestimmt `targetValueType` die Eingabe-/Anzeige-Wertung (z.B. Zehntelringe), nicht die Disziplin-Wertungsart. Jeder Effective-Scoring-Aufruf braucht alle drei Inputs: `scoringMode` + `discipline` + `targetValueType`.
