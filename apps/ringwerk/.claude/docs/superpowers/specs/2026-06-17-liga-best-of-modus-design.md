# Design: Liga-Modus „Best-of-Begegnung" (BEST_OF_SINGLE)

**Stand:** 17.06.2026
**Status:** Entwurf — **wartet auf Go der Sportleitung**, bevor die Umsetzung startet.
**Fachliche Beschreibung (Sportleitung):** siehe `2026-06-17-liga-best-of-modus-sportleitung-vorschlag.md`

---

## 1. Kontext & Motivation

Der heutige Liga-Modus fährt eine **Doppelrunde** (Hin- und Rückrunde), in der jede Begegnung
aus **einer Serie pro Schütze** besteht. Schwächen: viele Einzeltermine und hohe
Zufallsabhängigkeit (eine Serie entscheidet).

Dieser Entwurf führt einen **alternativen** Gruppenphasen-Ablauf ein:

- **Einfache Runde** (jeder gegen jeden **einmal**) statt Doppelrunde → halbiert die Termine.
- Jede Begegnung ist ein **Best-of-N** (Default Best-of-3) statt einer Einzelserie → senkt den
  Zufall. Danach Playoffs im Best-of-5.

Der bisherige Modus bleibt unverändert erhalten. Die Wahl erfolgt pro Liga beim Anlegen.

---

## 2. Geklärte Entscheidungen

| #   | Thema                               | Entscheidung                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Format                              | Neues `leagueFormat`: `DOUBLE_ROUND_ROBIN` (Default = heute) \| `BEST_OF_SINGLE` (neu). Wahl beim Anlegen, **nach Spielplan-Generierung gesperrt**.                                                                                                                                                                          |
| 2   | Spielplan                           | Einfache Runde (Single Round Robin). Ungerade TN-Zahl → rotierendes Freilos = **Pause ohne Wertung** (kein Phantomsieg).                                                                                                                                                                                                     |
| 3   | Begegnung                           | Best-of-N, Default Best-of-3 (`groupBestOf`). Playoffs Best-of-5 (`playoffBestOf`, unverändert).                                                                                                                                                                                                                             |
| 3a  | Alle Duelle ausspielen              | `groupPlayAllDuels` — **Standard: an** (immer alle N Duelle, z. B. 3 bei Best-of-3). Wirkt **nur** auf die Satzdifferenz, **nicht** auf Match-Siege (siehe §7).                                                                                                                                                              |
| 4   | Duell-Sieger                        | Allein über `scoringMode`. **Gleicher Wertungswert → Duell unentschieden** (z. B. gleicher Ringteiler, auch aus unterschiedlichen Ringen/Teilern). Optionales Sekundärkriterium (`groupTiebreaker1/2`, Default aus) nur als Override, v. a. für reine Ringe-Ligen.                                                           |
| 5   | Match-Gleichstand → **Stechschuss** | Steht eine Begegnung nach allen Duellen gleich (gleich viele Duell-Siege): **Stechschuss** — je ein Schuss in **Zehntelwertung**, höherer gewinnt, bei Gleichstand wiederholen bis einer besser ist. **Standard** (`groupHasSuddenDeath = true`), einheitlich mit dem Finale. Alternative: Wiederholungsduell. Details §4.2. |
| 5a  | Stechschuss erfassbar               | Der Stechschuss **muss in der Erfassungsmaske eingegeben werden** (Zehntelwert pro Schütze), damit die Software den Gleichstand korrekt wertet — nicht nur „am Stand" entscheiden. Siehe §6.                                                                                                                                 |
| 6   | Wertungsmodi                        | Nur `RINGS`, `RINGS_DECIMAL`, `TEILER`, `RINGTEILER` (kein `DECIMAL_REST`, kein `TARGET`).                                                                                                                                                                                                                                   |
| 7   | Tabelle                             | Zähl-Einheit = **Match-Siege**. Sortierkette: Siege → Satzdifferenz → mehr gewonnene Sätze → bestes Einzelergebnis. **Keine Unentschieden** möglich (Stechschuss erzwingt einen Sieger).                                                                                                                                     |
| 8   | Datenmodell                         | Ansatz „Matchup bleibt Paarung, Duelle als Serien" (`Series.duelNumber`, Stechschuss via `Series.isTiebreak`). Playoff-Strukturen unberührt.                                                                                                                                                                                 |
| 9   | Terminabstimmung                    | „Heimrecht" entfällt fachlich. **Termin wird gemeinsam abgestimmt** (keine feste Zuständigkeit). `homeParticipantId`/`awayParticipantId` nur zur Speicherung der Paarung. Datenmodell unverändert.                                                                                                                           |
| 10  | Playoffs                            | Best-of-5, **unverändert**. Seeding aus der neuen Tabelle. Stechschuss-Konzept = dasselbe wie der bestehende Finale-Sudden-Death.                                                                                                                                                                                            |

---

## 3. Datenmodell

### 3.1 Competition (neue Felder)

```prisma
enum LeagueFormat {
  DOUBLE_ROUND_ROBIN   // heutiger Modus (Default)
  BEST_OF_SINGLE       // neu: einfache Runde, Best-of-Begegnungen
}

model Competition {
  // ...
  leagueFormat LeagueFormat @default(DOUBLE_ROUND_ROBIN)
  // „N" in Best-of-N (ungerade), nur bei BEST_OF_SINGLE relevant. Default 3 = Best-of-3.
  // Nötige Siege = ceil(N/2) via bestehender requiredWinsFromBestOf().
  groupBestOf  Int?         @default(3)
  // Immer alle N Duelle ausspielen (kein vorzeitiges Ende bei geklärter Mehrheit).
  // Empfohlener Standard / Formular-Default bei BEST_OF_SINGLE: true.
  groupPlayAllDuels Boolean @default(false)
  // Optionaler Override (Default aus): Sekundärkriterien, um einen Wertungs-Gleichstand im Duell
  // doch ohne Stechschuss zu brechen. Aus → gleicher Wert = unentschieden → Match-Stechschuss.
  groupTiebreaker1  ScoringMode?
  groupTiebreaker2  ScoringMode?
  // Match-Gleichstand-Auflösung: true = Stechschuss (Standard), false = Wiederholungsduell.
  groupHasSuddenDeath Boolean @default(true)
}
```

- `leagueFormat` ist nach Spielplan-Generierung gesperrt (wie das übrige Liga-Regelset).
- `groupBestOf` ist bewusst getrennt von `playoffBestOf` (Gruppe Best-of-3, Playoffs Best-of-5).
- `groupPlayAllDuels` — **empfohlener Standard: an** (Formular-Default bei BEST_OF_SINGLE): „Alle
  Duelle ausspielen", auch eine bereits entschiedene Begegnung schießt die volle Best-of-Länge. Gilt
  **liga-weit** und ist mit dem Regelset gesperrt; Tabellen-Auswirkung siehe §7.
- `groupTiebreaker1/2`: **optionaler Override** (Default aus). Ohne Konfiguration gilt: gleicher
  `scoringMode`-Wert = **Duell unentschieden** → Match-Stechschuss. Mit Konfiguration werden
  Gleichstände erst über die Sekundärkriterien gebrochen (v. a. sinnvoll bei reiner Ringe-Wertung, wo
  gleiche Ringe häufig sind). Details §4.1.
- `groupHasSuddenDeath` — **Standard: true** = Stechschuss bei Match-Gleichstand (analog
  `finaleHasSuddenDeath`); `false` = Wiederholungsduell. Details §4.2.
- Im Anlegen-Formular wird `scoringMode` bei `BEST_OF_SINGLE` auf die vier zulässigen Modi
  beschränkt; Sekundärkriterien ebenfalls aus diesen vier.

### 3.2 Series (neue Felder + Constraint-Änderung)

```prisma
model Series {
  // ...
  // Liga BEST_OF_SINGLE: 1..N (Duell-Nummer); Stechschüsse laufen über N hinaus weiter.
  // Liga DOUBLE_ROUND_ROBIN: 1 (genau eine Serie pro Schütze pro Matchup).
  // Event/Saison: null (kein Matchup-Bezug).
  duelNumber Int?
  // Stechschuss-Schuss (Tie-Break): true = Einzelschuss in Zehntelwertung, kein reguläres Duell.
  isTiebreak Boolean @default(false)

  // bisher: @@unique([matchupId, participantId])
  @@unique([matchupId, participantId, duelNumber])
}
```

- **Migration:** Bestehende Liga-Serien (`matchupId != null`) bekommen `duelNumber = 1`,
  `isTiebreak = false`. Pre-launch → praktisch keine Daten. Event/Saison-Serien (`matchupId = null`)
  bleiben `null`; ihre Eindeutigkeit regelt weiterhin `@@unique([competitionParticipantId])`.
- Jedes reguläre Duell = ein Paar `Series` mit gleicher `duelNumber`. Damit erscheinen die Duell-
  Ergebnisse automatisch überall, wo `Series` schon konsumiert wird (Profil, „bestes Einzelergebnis",
  Statistik, PDF).
- **Stechschuss-Serien:** `isTiebreak = true`, `shotCount = 1`, Dezimal-Wert (Zehntelwertung) in
  `rings`, `teiler` ungenutzt (0). `duelNumber` läuft über N hinaus (je Stechschuss-Runde +1). Ein
  Eintrag pro Schütze pro Runde, Wiederholung bis entschieden. **Von „bestes Einzelergebnis"/
  Statistik ausgeschlossen** (es ist kein reguläres Serienergebnis).

### 3.3 Matchup — unverändert

`Matchup` bleibt der Spielplan-Slot (Spieltag, Status, Stichtag, A/B-Plätze). `winsHome`/`winsAway`
werden **nicht** persistiert, sondern aus den `Series`-Duellen abgeleitet (eine Quelle der
Wahrheit). Die Felder `homeParticipantId`/`awayParticipantId` werden bei `BEST_OF_SINGLE` rein
organisatorisch interpretiert.

---

## 4. Geteilte Best-of-Logik

Die Best-of-Auflösung wird aus dem Playoff-Code in ein **reines, getestetes Modul** extrahiert und
von Playoffs **und** Gruppen-Best-of genutzt.

- `lib/scoring/bestOf.ts` (neu): `resolveBestOf(duels, requiredWins, compareDuel, opts)` → wertet je
  Duell den Sieger (oder „unentschieden"), zählt Duell-Siege je Seite und ermittelt den Match-Status.
  - **Alle Duelle ausspielen (`playAll`, Standard):** Es werden N Duelle gespielt; Match-Sieger ist
    die Seite mit den **meisten Duell-Siegen**.
  - **Frühes Ende (Option):** Abschluss sobald eine Seite die Mehrheit nicht mehr verlieren kann
    (`requiredWins = ceil(N/2)`).
  - **Match-Gleichstand** (gleich viele Duell-Siege nach N Duellen, weil mind. ein Duell unentschieden
    war): je `groupHasSuddenDeath` **Stechschuss** (Standard) oder **Wiederholungsduell**. Siehe §4.2.
- Wiederverwendung: `requiredWinsFromBestOf(groupBestOf)` (`ceil(N/2)`), die Finale-Ketten-Logik
  (`compareByFinale`) für den Duell-Vergleich, `determineOutcome` als Default-Sekundärwertung.
- **Abgrenzung:** Playoff-VF/HF nutzt weiter den Ringteiler-festen Vergleich; **Gruppen-Best-of und
  Finale teilen sich die Ketten-Logik und das Stechschuss-Prinzip**. Geteilt werden Orchestrierung
  (Siege zählen, Abschluss, Stechschuss) und der Ketten-Vergleich.

### 4.1 Duell-Vergleich (Sieger eines einzelnen Duells)

Ein Duell wird **allein über den league-`scoringMode`** entschieden. **Ist der Wertungswert gleich,
ist das Duell unentschieden** — standardmäßig wird es **nicht** über ein Zweitkriterium getrennt:

| Modus                 | Duell-Sieger                    | unentschieden, wenn …                                               |
| --------------------- | ------------------------------- | ------------------------------------------------------------------- |
| RINGS / RINGS_DECIMAL | höhere Ringe                    | gleiche Ringzahl                                                    |
| TEILER                | kleinerer (korrigierter) Teiler | gleicher Teiler                                                     |
| RINGTEILER            | niedrigerer Ringteiler          | **gleicher Ringteiler** (auch aus unterschiedlichen Ringen/Teilern) |

Das ist für den Ringteiler bewusst so: Bei gleichem Ringteiler sind beide nach der gewählten Wertung
gleichwertig — statt sie über ein willkürliches Zweitkriterium (mehr Ringe / besserer Teiler) zu
trennen, entscheidet bei Match-Gleichstand ein **Stechschuss** (§4.2). Damit ist die frühere offene
Frage „Ringe- oder Teiler-zuerst" **gegenstandslos**.

**Optionaler Override (`groupTiebreaker1/2`, Default aus):** Eine Liga kann Duell-Gleichstände doch
über Sekundärkriterien brechen, bevor ein Duell als unentschieden gilt — sinnvoll v. a. bei **reiner
Ringe-Wertung**, wo gleiche Ringe häufig sind und sonst viele Stechschüsse entstünden (dort z. B.
`groupTiebreaker1 = TEILER`). Bei Ringteiler/Teiler sind exakte Gleichstände selten, daher bleibt der
Override dort meist aus.

### 4.2 Match-Gleichstand → Stechschuss (Standard)

Steht eine Begegnung **nach allen Duellen gleich** (gleich viele Duell-Siege — möglich, weil mind.
ein Duell **wertungsgleich** ausging, z. B. gleicher Ringteiler), wird sie so aufgelöst:

- **`groupHasSuddenDeath = true` (Standard) → Stechschuss:** Je **ein Schuss** pro Schütze in
  **Zehntelwertung**; der höhere Wert gewinnt die Begegnung. Sind beide gleich, wird **ein weiterer
  Stechschuss** geschossen — so lange, bis einer besser ist.
- **`groupHasSuddenDeath = false` → Wiederholungsduell:** Es wird ein weiteres volles Duell gespielt,
  bis die Begegnung nicht mehr gleich steht.

Eigenschaften:

- Der Stechschuss **entscheidet das gleichstehende Duell** für den Stechschuss-Sieger; dieses Duell
  **zählt im Satzverhältnis mit**. Eine per Stechschuss entschiedene Best-of-3-Begegnung endet damit
  z. B. **2:1** (nicht „1:1") und behält die „keine Unentschieden"-Garantie der Tabelle. In der
  Kurzanzeige wird sie als „2:1 n. St." markiert. Der Stechschuss-Schuss selbst zählt nicht als
  Serie für „bestes Einzelergebnis".
- Der Stechschuss ist **dasselbe Prinzip wie der bestehende Finale-Sudden-Death** (Einzelschuss) →
  einheitlich über Vorrunde und Finale, vertraut für die Schützen.
- **Zehntelwertung** macht ein zweites Patt sehr unwahrscheinlich; meist fällt die Entscheidung im
  ersten oder zweiten Stechschuss.

---

## 5. Spielplan-Generierung

- `lib/matchups/generateSchedule.ts` bekommt eine **Single-Round-Robin-Variante** (Circle-Method,
  ein Durchlauf statt zwei). Bei `BEST_OF_SINGLE` wird diese genutzt; bei `DOUBLE_ROUND_ROBIN`
  bleibt die heutige Doppelrunde.
- Ungerade TN-Zahl → rotierendes Freilos je Spieltag = **Pause ohne Wertung**. Jeder Schütze
  bestreitet ohnehin N−1 echte Begegnungen; das Freilos vergibt **keine** Punkte/Siege.
- Mindest-Teilnehmerzahl bleibt 4. Regenerierung möglich solange keine abgeschlossene Begegnung.

---

## 6. Ergebniserfassung

Ablauf wie bei Playoff-Best-of (VF/HF), nur am `Matchup` statt am `PlayoffMatch`:

- Begegnungs-Detailansicht: **Duell für Duell** erfassen — je Duell eine Serie pro Schütze. Ein Duell
  kann mit Sieger oder **unentschieden** enden (gleicher Wertungswert, z. B. gleicher Ringteiler); ein
  unentschiedenes Duell wird als solches gespeichert und bleibt stehen (kein sofortiges Nachschießen).
- Nach allen Duellen ermittelt `resolveBestOf` den Match-Sieger über die Duell-Siege.
- **Stechschuss-Erfassung (Pflicht in der Maske):** Steht die Begegnung danach **gleich**, blendet die
  Erfassungsmaske einen **Stechschuss-Schritt** ein: je **ein Zehntelwert pro Schütze**. Höherer
  gewinnt; bei Gleichstand erscheint sofort die nächste Stechschuss-Eingabe, bis einer besser ist.
  - **Wichtig:** Das Stechschuss-Ergebnis **muss in der Software erfasst werden** — nur dann wertet die
    Tabelle den Gleichstand korrekt. Es reicht **nicht**, das Stechen nur am Stand auszutragen. Das
    Kriterium ist also Teil der Erfassungsmaske, nicht bloß eine Stand-Regel.
  - Gespeichert als `Series` mit `isTiebreak = true`, `shotCount = 1` (siehe §3.2).
- `Matchup.status = COMPLETED`, sobald der Sieger feststeht (inkl. evtl. Stechschuss).
- Server Actions in `lib/results/actions.ts` (oder neuem `lib/results/bestOf*`); AuditLog-Ereignisse
  analog `RESULT_ENTERED`/`RESULT_CORRECTED` (mit `duelNumber` bzw. Stechschuss-Marker im Details-JSON).
- Korrektur/Löschung: jüngstes Duell bzw. jüngster Stechschuss zurücknehmbar solange die Begegnung
  dadurch konsistent bleibt (Muster analog Playoff `canCorrect`).

---

## 7. Tabelle

- Neue reine Funktion `lib/standings/calculateBestOfStandings.ts` (eigenständig neben der
  klassischen `calculateStandings.ts` — zwei fokussierte Funktionen statt einer überladenen).
- Pro Begegnung: reguläre `Series` (nicht `isTiebreak`) nach `duelNumber` gruppieren, je Duell den
  Sieger ermitteln, Duell-Siege zählen → Match-Sieger; bei Gleichstand entscheidet der **Stechschuss**
  (höchster `isTiebreak`-Wert je Runde). Begegnungen mit zurückgezogenem Teilnehmer ausschließen.
- Zeilenwerte: `played` (Begegnungen), `wins`, `losses`, `duelsWon`, `duelsLost`,
  `duelDiff` (= won − lost), `bestRingteiler`/`bestRings`.
- **Sortierkette** (bewusst nur tabellensichtbare Kriterien — der direkte Vergleich entfällt, damit
  die Reihenfolge aus den angezeigten Spalten ablesbar ist; Spaltenreihenfolge = Bewertungsreihenfolge):
  1. Match-Siege (absteigend)
  2. Satzdifferenz (`duelDiff`, absteigend)
  3. Mehr gewonnene Sätze (`duelsWon`, absteigend)
  4. Bestes Einzelergebnis (modusabhängig: höchste Ringe bzw. niedrigster Ringteiler; **ohne**
     Stechschuss-Serien)
  5. Nachname (Stabilisierung)
- Zurückgezogene Teilnehmer ans Tabellenende (wie heute).

**Auswirkung von `groupPlayAllDuels`:** Die Match-Siege (Kriterium 1) bleiben **unverändert** — der
Match-Sieger ist die Mehrheit der Duelle (bzw. der Stechschuss-Sieger bei Gleichstand). Betroffen ist
**nur die Satzdifferenz** (Kriterium 2): voll ausgespielte
Begegnungen liefern den vollen Satz-Spread. Da die Einstellung **liga-weit** gilt, bleibt das fair.
Ein per Stechschuss entschiedenes Match zählt als Sieg/Niederlage; das per Stechschuss gewonnene
Duell zählt im Satz mit (z. B. 2:1).

**Worked Example (3er-Gleichstand):** Eva/Frank/Georg je 5 Siege; Head-to-Head zirkulär
(Eva→Frank→Georg→Eva) und nicht mehr gewertet — die Satzdifferenz +8 / +5 / +1 entscheidet direkt
→ Eva, Frank, Georg.

---

## 8. Terminabstimmung (ersetzt „Heimrecht" für diesen Modus)

- „Heimrecht" war nie ein sportlicher Vorteil (kein Vorschiessen, gemeinsames Antreten). Im
  Doppelrunden-Modus existieren zwei „Seiten" nur wegen des Hin-/Rück-Wechsels.
- Bei einer einzigen Begegnung entfällt das. **Der Termin wird von beiden Schützen gemeinsam
  abgestimmt** — keine feste Zuständigkeit. UI/PDF zeigen die Paarung bei `BEST_OF_SINGLE` neutral
  als „A – B" (kein „Heim/Gast", keine „Terminverantwortung"). **Keine Schema-Änderung** —
  `homeParticipantId`/`awayParticipantId` dienen nur der Speicherung der Paarung.

---

## 9. Playoffs — unverändert

- Best-of-5 (`playoffBestOf`), Seeding aus `calculateBestOfStandings`. `StandingRow`-Form kompatibel
  halten, damit `createFirstRoundMatchups` weiter funktioniert.
- Start-Guard „keine PENDING-Begegnungen in der Gruppenphase" gilt unverändert (alle Matchups
  `COMPLETED`, inkl. evtl. Stechschuss).
- Der Stechschuss der Vorrunde ist **dasselbe Prinzip** wie der bestehende Finale-Sudden-Death — die
  Playoff-Logik selbst wird hier nicht angefasst (Scope).

---

## 10. PDF / Auswertung

- `lib/pdf/SchedulePdf.tsx`: Variante für `BEST_OF_SINGLE` — einfache Runde, Begegnungen mit
  Satzergebnis („2:1"; per Stechschuss entschieden als „2:1 n. St."), Tabelle mit den neuen Spalten
  (Siege/Satzdifferenz/Satzverhältnis/bestes Erg.); „Heim/Gast" entfällt.
- Öffentliches PDF (`/api/public/c/[slug]/pdf`) bleibt phasenabhängig: vor Playoff-Start
  Spielplan+Tabelle (Best-of-Variante), nach Start Playoff-Bracket. Cache-Invalidierung wie bisher.

---

## 11. Betroffene Bereiche (Layer-Order)

1. **Schema + Migration** — `LeagueFormat`, `Competition.leagueFormat`/`groupBestOf`/
   `groupPlayAllDuels`/`groupTiebreaker1`/`groupTiebreaker2`/`groupHasSuddenDeath`, `Series.duelNumber`/
   `Series.isTiebreak`, Unique-Constraint, Datenmigration (`duelNumber=1` für Liga-Altserien).
2. **Types** — `lib/competitions/types.ts`, `lib/standings`/`lib/results` Typen um Duell-/Best-of-/
   Stechschuss-Felder erweitern.
3. **Scoring/Calculate** — `lib/scoring/bestOf.ts` (neu, Tests), `calculateBestOfStandings.ts` (neu,
   Tests), `generateSchedule.ts` Single-Pass (Tests), Extraktion der `compareByFinale`-Kette in einen
   geteilten Helfer.
4. **Queries/Actions** — Spielplan-Generierung (Format-Weiche), Best-of-Erfassung (Duell-Anlegen/
   Speichern/Korrektur, unentschiedene Duelle, **Stechschuss-Erfassung**, `playAll`-Abschluss), AuditLog.
5. **Components/Page** — Anlegen-Formular (Format-Toggle, `groupBestOf`, `groupPlayAllDuels`,
   Sekundärkriterien + Stechschuss-Schalter analog Finale, Modus-Beschränkung, Sperre nach
   Generierung), Begegnungs-Detail-/Erfassungs-UI (Duell-Karten **+ Stechschuss-Eingabe in Zehntel**),
   Tabellen-UI (Format-Weiche, neue Spalten), Spielplan-Anzeige.
6. **PDF** — `SchedulePdf.tsx` Best-of-Variante; öffentliche Route phasenabhängig.
7. **Docs** — `features.md`, `data-model.md`, `architecture.md`, `reference-files.md`.

---

## 12. Teststrategie

- **Pure Functions (pflichtig):** `resolveBestOf` (3:0 / 2:1 / Abschluss-Erkennung, Best-of-3 und
  Best-of-5; `playAll`; unentschiedenes Duell → Match-Gleichstand → **Stechschuss** entscheidet, inkl.
  wiederholtem Stechschuss bei gleichem Zehntelwert; Alternative Wiederholungsduell),
  `calculateBestOfStandings` (Sortierkette inkl. zirkulärem 3er-Patt, per Stechschuss entschiedene
  Begegnung zählt als Sieg und das Stechschuss-Duell im Satz mit (z. B. 2:1), Stechschuss-Serien aus
  „bestes Einzelergebnis" ausgeschlossen, Rückzug-Ausschluss, alle vier Modi), Single-Round-Robin-Generator.
- `determineOutcome` und die Finale-Kette (`compareByFinale`) sind bereits getestet; bei Extraktion
  Tests mitziehen/erweitern.
- **Action-Tests:** Duell-Erfassung; unentschiedenes Duell; **Stechschuss-Erfassung** erzeugt Sieger
  und schließt das Match ab; Korrektur/Rücknahme von Duell und Stechschuss.

---

## 13. Risiken & Altlasten

| Risiko                                                                                                                                                   | Mitigation                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`playoffBestOf`-Unstimmigkeit** (Schema-Kommentar „Siege nötig" vs. `requiredWinsFromBestOf` rechnet „N in Best-of-N") — Bestandsthema im Playoff-Code | Hier **nicht** angefasst. `groupBestOf` eindeutig als „N in Best-of-N" definiert. Empfehlung: Playoff-Benennung separat sauberziehen.                               |
| **Stechschuss nur „am Stand" statt erfasst** → Tabelle wertet Gleichstand falsch                                                                         | Stechschuss ist Pflichtbestandteil der Erfassungsmaske (§6, Entscheidung 5a); `resolveBestOf` schließt ein Match bei Gleichstand erst mit erfasstem Stechschuss ab. |
| `Series`-Konsumenten erwarten 1 Serie pro Matchup/Schütze (Profil, PDF, Statistik)                                                                       | Beim Umsetzen jede Konsumstelle prüfen; jetzt **mehrere** Serien pro Matchup/Schütze möglich; `isTiebreak`-Serien aus Statistik/„bestes Ergebnis" filtern.          |
| `groupPlayAllDuels` / Sekundärkriterien / Stechschuss müssen liga-weit & gesperrt sein                                                                   | Sonst unfaire Vergleiche über unterschiedliche Regeln. Als Liga-Config mit Regelset-Sperre umsetzen, nicht pro Paarung.                                             |
| Zehntel-Messung für den Stechschuss nötig                                                                                                                | Setzt messfähigen Stand voraus (wie beim Finale ohnehin).                                                                                                           |

---

## 14. Nicht-Ziele (YAGNI)

- **Keine** per-Paarung-einstellbare Best-of-Länge, Ausspiel- oder Tie-Break-Regel (liga-weit genügt).
- **Keine** frei wählbare Mindest-Duellzahl < N (nur „alles" via `groupPlayAllDuels` oder „Standard").
- **Keine** vom league-`scoringMode` abweichende Duell-**Primärwertung** (nur Sekundärkriterien und
  die Match-Gleichstands-Auflösung sind konfigurierbar).
- **Keine** Kombination Doppelrunde + Best-of (bewusst ein gebündelter Modus).
- **Kein** Anfassen des bestehenden Playoff-Verhaltens (außer der Logik-Extraktion in `bestOf.ts` /
  `compareByFinale`, die das Verhalten erhält).

---

## 15. Nächste Schritte

1. **Sportleitungs-Go abwarten** (fachliche Beschreibung versendet).
2. Danach: `writing-plans` → Detailplan mit `## Required Docs`.
3. Danach: Branch `feat/liga-best-of-modus` + Commit von Spec & Plan als **erster** Commit.
4. Danach: `subagent-driven-development`.
