---
id: season-mode
type: subsystem
title: "season-mode"
keywords: [Saison-Modus, Langzeitwertung, beste Serien, Mindestserien, Mindestzahl, ohne Mindestzahl, Ausnahme, Jugend, Jugendwertung, exemptFromMinSeries, requiredSeries, Mehrfach-Ranking, season mode, Jahreswertung, alternierende Sortierung, Ringe/Teiler alternierend, Teiler/Ringe alternierend, seasonSortMode, sortSeasonStandings, Anzeigereihenfolge, Rangliste sortieren, geteilte Plätze, seasonPositions, Gleichstand]
tags: [feature]
feature_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Saison-Modus (SEASON) ✓ IMPLEMENTIERT (Phase 5)]]"]
relates_to: ["[[factor-correction]]"]
---

**TL;DR** Langzeit; beste Serien zählen, Mehrfach-Ranking (Ringe/Teiler/Ringteiler), Mindestserien-Gate (minSeries default 20), Ausnahme „ohne Mindestzahl“ je Einschreibung (etwa Jugend).

## Ohne Mindestzahl (Ausnahme an der Einschreibung)

Im Verein braucht die Jugend keine Mindestzahl an Serien. Ringwerk führt dafür keine Altersklasse, sondern eine
Ausnahme an der Einschreibung: `CompetitionParticipant.exemptFromMinSeries`. Wer sie trägt, ist ab der ersten Serie in
der Wertung: oberer Block, Metrik-Ränge, Podium. Eine gemeinsame Rangliste, keine eigene Jugendwertung.

- **Eine Regel an einer Stelle:** `requiredSeries(minSeries, exempt)` in `lib/scoring/calculateSeasonStandings.ts`
  liefert die Mindestzahl der Zeile (`null` ohne Mindestzahl, mit Ausnahme höchstens `1`, sonst `minSeries`). Jede Zeile trägt
  sie als `requiredSeries`, `meetsMinSeries` folgt daraus. Sortierung, Plätze und Rang-Pool arbeiten unverändert nur mit
  `meetsMinSeries`. Mit Ausnahme und ohne Serie bleibt eine Zeile unten bei denen ohne Serie.
- **Wo sie wirkt:** `offersMinSeriesExemption` (gleiche Datei): nur `type=SEASON` mit `minSeries` über 1. Nur dort bieten
  Einschreiben (Kästchen „Keine Mindestzahl an Serien“) und Teilnehmerverwaltung (Zeichen „ohne Mindestzahl“, Knopf
  mit `DecisionDialog`, nur in einer aktiven Saison) sie an, und nur dort speichern `enrollParticipant` und `updateMinSeriesExemption` sie. Bekommt
  eine Saison später eine Mindestzahl, gilt der gespeicherte Wert wieder.
- **Anzeige:** Spalte „Serien“ und Zusatz am Telefon in Tabelle, PDF und Vorschau über `seasonSeriesLabel` (`3/1`
  statt `3/20`); „Serien erfassen“ zeigt `3 Serien / 1 Mindest`. Kein Zeichen am Namen in Rangliste und PDF, die Zahl
  hinter dem Strich zeigt die Ausnahme offen. Die Hilfe „Reihenfolge der Rangliste“ erklärt die 1.
- **Umstellen** geht jederzeit (Saison und Einschreibung aktiv), auch mit Serien. Update und Protokolleintrag
  `MIN_SERIES_EXEMPTION_CHANGED` laufen in einer Transaktion; die Bedingungen stehen im `updateMany` selbst, ändert
  sich keine Zeile, gibt es keinen Eintrag. Texte: Textbuch, Abschnitt „Ringwerk: Saison ohne
  Mindestzahl“.

## Anzeigereihenfolge der Rangliste

`calculateSeasonStandings` berechnet **immer alle drei** Metriken samt Einzelrängen; die
**Reihenfolge** kommt ausschließlich aus der reinen Funktion `sortSeasonStandings`
(`lib/scoring/sortSeasonStandings.ts`) — genutzt von Tabelle, Wettbewerbs-PDF, öffentlichem PDF
und Dashboard. Keine Oberfläche sortiert selbst, und die Dashboard-Karte schneidet die Top-5 erst
**nach** dem Sortieren ab.

`resolveSeasonSort(scoringMode, seasonSortMode)` liefert fünf Reihenfolgen:

- **klassisch** — `rings` / `teiler` / `ringteiler`, abgeleitet aus `scoringMode` (alles außer
  Ringe/Teiler fällt auf Ringteiler); Spaltenköpfe bleiben manuell sortierbar.
- **alternierend** — `alt-rings` / `alt-teiler` aus `Competition.seasonSortMode`
  (`ALT_RINGS_FIRST` / `ALT_TEILER_FIRST`, nullbar; null = klassisch). Die Rangliste wechselt
  zeilenweise zwischen **besten Ringen** und **bestem korrigiertem Teiler**
  ([[factor-correction]]): pro Platz der beste noch nicht platzierte Teilnehmer dieser Metrik,
  jeder genau einmal. Gleichstand → alphabetisch (`localeCompare "de"`). Blöcke wie gehabt:
  Qualifizierte, dann Nicht-Qualifizierte (jeder Block für sich alternierend), Teilnehmer ohne
  Serie alphabetisch am Ende. Der Ringteiler ist hier **kein** Kriterium, bleibt aber Spalte.

Jede Zeile trägt `alternatingBy` (`"rings" | "teiler" | null`); Tabelle und PDF heben damit den
Wert hervor, der den Platz ergeben hat, und nehmen die anderen zurück — sonst ist eine
alternierende Reihenfolge für Leser nicht überprüfbar (gleiche Linie wie
[[best-of-standings-direct-comparison-tiebreak]]). Manuelles Sortieren ist in diesen Modi
deaktiviert: die Reihenfolge **ist** die Wertung.

Auf schmalen Geräten ist neben dem Namen Platz für zwei Zahlenspalten. Sichtbar bleibt, was die
Reihenfolge bestimmt: in den alternierenden Modi **Ringe und Teiler** (der Ringteiler klappt weg),
klassisch die sortierte Spalte. Sonst stünde in `alt-teiler` jede zweite Zeile mit ihrem
maßgeblichen Wert in einer unsichtbaren Spalte. Gepinnt in `SeasonStandingsTable.test.tsx`.

## Ränge & Badges

Die drei Metrik-Ränge (`bestRings_rank`, `bestTeiler_rank`, `bestRingteiler_rank`) sind reine
Anzeigewerte und werden **nur für gewertete Teilnehmer** vergeben — wer `minSeries` nicht erreicht,
trägt keinen Rang (sein Wert bleibt sichtbar, die Zeile ist ausgegraut). Bekäme jeder mit
mindestens einer Serie Ränge, hielte eine ausgegraute Zeile die 1, während die gewerteten Zeilen
darüber 2, 3, 3 läsen. Rang-Pool und Sortier-Pool müssen deshalb deckungsgleich bleiben.

Die **Gesamtplatzierung** am Namen kommt aus `seasonPositions(sorted, sort)` — der einzigen Quelle
für Tabelle, PDF und Dashboard. Klassisch teilen Zeilen den
Platz, die im Block, in der Metrik **und** im Ringteiler gleich sind — der Ringteiler ist bei
gleichem Metrik-Wert der explizite Tiebreak, erst danach der Name. Teilnehmer ohne Serie stehen
also gemeinsam auf einem Platz; hat noch niemand eine Serie, alle auf 1. Alternierend vergibt die
Folge jeden Platz einzeln, geteilt wird nur im Block ohne Serie. Podiumsfarben trägt nur eine Zeile
mit mindestens einer Serie (`hasSeasonResult`). Siehe [[ringwerk-features]] („Geteilte Plätze").

Angezeigt werden Inline-Platzierungen an den Metrik-Werten nur für die **Plätze 1–3** (Tabelle und
PDF, Regel + Hervorhebung liegen als `isPodiumRank`/`metricAppearance` neben der Sortierfunktion);
die Gesamtplatzierung am Namen steht auf jeder Zeile. Ein Badge an jedem Wert wäre unübersichtlich.

Auch mit deckungsgleichen Pools kann die Folge einen **Sprung** zeigen (1, 1, 2, 3): wenn der
Nächstplatzierte einer Metrik schon über die andere Metrik platziert wurde. Das ist die Folge von
„jeder Schütze genau einmal" und in den Tests festgehalten, kein Rechenfehler.

Im Formular führt **eine** Auswahl „Wertungsmodus" beide Felder: ein alternierender Eintrag setzt
`seasonSortMode` **und** `scoringMode = RINGTEILER` — der neutrale Wert, bei dem das
Ringe-Eingabeformat der Disziplin folgt (`getEffectiveScoringType`). Genau deshalb sind die
alternierenden Werte **kein** `ScoringMode`: das Enum ist exhaustive in `calculateScore` /
`SCORE_DIRECTION` und trägt zusätzlich Liga-Duelle und Playoff-Kriterien, wo „alternierend" keine
Bedeutung hätte. Bildschirm und PDF zeigen in diesen Modi das Sortier-Label statt des
Wertungsmodus, weil „Ringteiler" dort nur noch das Eingabeformat trägt.
