# Spiegel: Rückmeldungen aus dem ersten Test, vor allem mobil

## Kontext

Spiegel läuft seit dem 14. Oktober 2026 in Produktion, mit den eigenen 34 Scheiben des Users (über die Brücke aus der
Kopie vom 9. Oktober). Beim Testen, vor allem am Telefon, sind dem User acht Dinge aufgefallen (15. Oktober 2026,
wörtlich):

1. „Scheibe: Rangliste anzeigen, zu der die Scheibe gehört“
2. „Scheiben: Rangliste anzeigen, als Filter“
3. „Scheibe: Einzelschüsse immer in Zehntelwerten anzeigen egal wie die Scheibe eingestellt ist. Auch beim Verlauf je
   Schuss, auch das Zehntel Histogramm anzeigen“
4. „Scheibe: auch kleinere Pausen erkennen“
5. „Scheibe: beim Wechsel zwischen den tabs in Analyse zum Beginn der Analyse scrollen, nicht zum Ende“
6. „Ranglisten einfach ‚Listen‘ nennen“
7. „Fortschritt: letzten gewählten Zeitraum merken für die Zukunft“
8. „Kalender ‚blätterbar‘ für ältere einträge“

Der User hat die Umsetzung freigegeben („mache das autonom“). Keine Schemaänderung, keine geschützten Pfade: autonom
nach ADR-023. Bestandsaufnahme durch zwei Agenten (15. Oktober 2026), Belege in den Entscheidungen.

## Entscheidungen

- **D1 Liste an der Scheibe** (1): Die Zugriffe holen die Rangliste schon für die Art (`OVERVIEW_SELECT`,
  `PAGE_CARD_SELECT`, `ranking: { select: { kind } }`); sie holen dazu `id` und `name`. `OverviewCard` und `PageCard`
  bekommen `list: { id: number; name: string } | null` (Scheiben aus dem PDF oder `seed:own` haben keine). Im Kopf der
  Seite steht sie als „Liste RWK_LP“ in der Zeile unter dem Titel, nach der Art (`cardMeta` mit optionaler Liste).
- **D2 Filter „Liste“ in Scheiben** (2): `ListQuery.list: number | null`, in der Adresse als `list=<id>` (Ids, nie Namen;
  `SLUG` passt nicht zu „RWK_LP“). `cardListModel` filtert danach und nennt die vorhandenen Listen (`lists: {id, name}[]`,
  nach Name; eine gewählte bleibt, auch wenn sie leer ist, wie bei den Merkmalen). Im Blatt „Filter“ als Chips unter
  „Liste“, wie „Merkmal“; die Zusammenfassung am Chip nennt sie. `listOnEvening` und `progressFromList` lassen den Filter
  weg (Abend und Fortschritt kennen ihn nicht), `areaLinks` behält ihn mit der übrigen Abfrage.
- **D3 „Listen“ statt „Ranglisten“** (6): in jeder sichtbaren Zeile (Admin „Anlage und Brücke“, Dialog zur Art, Erklärung
  hinter „?“, Seite einer Scheibe, Filter). Die Leitplanke `OLD_WORDS` bekommt `Rangliste`. Wo „Liste“ in der Hilfe die
  Seite „Scheiben“ meint („in der Liste der Scheiben“), heißt sie jetzt „unter Scheiben“. Bezeichner im Code und der
  Name der Meyton-Spalte `Rangliste` bleiben. Erst ins Textbuch (Abschnitt „Nach Teil 1 geändert“), dann in den Code.
- **D4 Einzelschüsse immer in Zehnteln** (3): neue Formatierung `formatShotValue(shot)` in `shot-ui/src/shots.ts`:
  Zehntel, fehlen sie (SF-18), der Ring ohne Nachkommastelle. Sie gilt für Schusstabelle (Spaltenkopf immer „Wert“),
  Ablesung (`ShotReadout`, `ShotLine`; die kleine Zeile darunter nennt dann immer den Ring), Hinweis an den Markern der
  Scheibe und die Karte „Verlauf je Schuss“ (`CourseChart`, gleitender Schnitt und Trend dort auch in Zehnteln, sonst
  läge die Linie neben den Punkten). Die Zehntelverteilung steht immer da. Summen, Ø, Serien, Quoten, Kacheln und
  Beobachtungen folgen weiter der Wertung der Scheibe. Hilfe: `zehntelverteilung` und der Einstieg „Ganze Ringe oder
  Zehntel“ sagen das neu; der Vault-Leitfaden wird aus `shot-help` neu erzeugt.
- **D5 Kleinere Pausen** (4): Faktor 2,5 → **2,0** („über dem Doppelten deines üblichen Abstands“), Grenzen 60 s und
  180 s bleiben. Nachgezählt an den eigenen Scheiben (26 Scheiben, 789 Abstände): 2,5 findet 11 Pausen, 2,0 findet 18,
  1,5 schon 39 (5 % aller Abstände, auch gewöhnliche Schwankung). Die Kennzahlen Z1 und Z2 (`time.intervalMedian`,
  `time.tempoSpread`) hängen an der Regel: Version 3 → 4, die Projektion rechnet beim Start des Servers nach.
- **D6 Reiterwechsel springt an den Anfang der Analyse** (5): Heute ändert `changeTab` nur Zustand und Anker; ist der neue
  Reiter kürzer, klemmt der Browser ans Seitenende. Neu: nach dem Wechsel, wenn der Anfang der Karten oberhalb der
  klebenden Leiste liegt, die Karten an den Anfang scrollen (unter die Leiste: 56 px am Telefon, 112 px ab `md`, wie
  „Alle Beobachtungen“). „Alle Beobachtungen“ scrollt weiter selbst zu seiner Karte.
- **D7 Zeitraum im Fortschritt merken** (7): als Cookie `spiegel-period` auf dem Gerät, wie die Darstellung der Scheibe
  (`spiegel-target`), keine Schemaänderung. Geschrieben, wenn der Zeitraum im Blatt „Filter“ übernommen wird, nie beim
  Öffnen; gelesen auf dem Server, wenn `/progress` **ganz ohne** Abfrage geöffnet wird (Navigation). Links mit eigener
  Abfrage (Start „Form der letzten 90 Tage“, aus der Liste) gelten wie heute. Ein gemerkter Zeitraum mit unbekannter
  Kennung fällt auf die Vorgabe zurück (`resolveRange`).
- **D8 Kalender blätterbar** (8): der Kalender im Fortschritt (Umfang → „Kalender“). Heute zeigt er nur den gewählten
  Zeitraum und lässt sich nur per (verstecktem) seitlichem Scrollen bewegen. Neu: Er kennt die Trainingstage aller
  Scheiben der Familie (gefiltert nach Art wie der Zeitraum; je Abend ein kleiner Eintrag), zeigt ein Fenster von der
  Länge des Zeitraums (mindestens 13 Wochen) und hat „‹ früher“ und „später ›“, die das Fenster um seine Länge
  verschieben, begrenzt durch die erste Scheibe und heute. Am Anfang endet das Fenster am Ende des Zeitraums.

## Nicht in diesem Plan

- Die Liste als Filter im Fortschritt und eine Verknüpfung „alle Scheiben dieser Liste“ auf der Seite einer Scheibe.
- Den Zeitraum über Geräte hinweg merken (bräuchte eine Spalte am Konto und eine neue Migration).

## Required Docs

- `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`, `packages/shot-help/CLAUDE.md`
- `vault/conventions.md` §10 „So schreiben wir“, Textbuch „Textbuch Spiegel“ (Claude Docs)
- `vault/spiegel/spiegel-statistics.md` (Z1, Z2, Z4, V2), `vault/spiegel/spiegel-navigation.md`
- `plans/2026-10-10-spiegel-pausen-relativ.md` (Herleitung des Faktors 2,5)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/src/lib/db/reads.ts` (+ Tests), `src/lib/pages.ts` | T2 |
| `packages/shot-ui/src/readout/cardMeta.ts` (+ Test), `apps/spiegel/src/components/card/CardScreen.tsx` | T3, T7 |
| `packages/shot-ui/src/nav/routes.ts`, `nav/navigate.ts`, `list/evenings.ts`, `list/ListControls.tsx` (+ Tests), `apps/spiegel/src/components/list/ListScreen.tsx` | T4 |
| `apps/spiegel/src/app/(app)/admin/site/page.tsx`, `src/components/admin/SiteForms.tsx`, `src/lib/admin/consequences.ts`, `help.ts` (+ Tests), `packages/shot-help/src/topics.ts`, `guide.ts` | T5 |
| `packages/shot-ui/src/shots.ts`, `table/ShotTable.tsx`, `readout/*`, `target/TargetView.tsx`, `analysis/tabs/ResultTab.tsx`, `TimeTab.tsx`, `analysis/charts/CourseChart.tsx` (+ Tests), `packages/shot-help/src/*`, `vault/spiegel/spiegel-statistics-help.md` (erzeugt) | T6 |
| `packages/shot-core/src/time.ts`, `metrics.ts`, Tests (`time`, `timing`, `metrics`, `projection`), `apps/spiegel/tools/own-cards.test.ts`, `shot-ui` `TimeTab` | T7 |
| `apps/spiegel/src/components/card/CardScreen.tsx`, `tools/pruefen.ts` | T8 |
| `apps/spiegel/src/lib/period-memory*.ts` (neu), `src/app/(app)/progress/page.tsx`, `src/components/progress/ProgressScreen.tsx` | T9 |
| `packages/shot-ui/src/period/model.ts`, `period/CalendarChart.tsx` (+ Tests), `ProgressScreen.tsx`, `tools/pruefen.ts` | T10 |
| `apps/spiegel/CLAUDE.md`, Paket-CLAUDE.md, `vault/spiegel/spiegel-statistics.md`, `spiegel-navigation.md` | T11 |

## Aufgaben

1. **T1 Textbuch:** Abschnitt „Nach Teil 1 geändert: Listen“ mit den neuen Wortlauten (Überschrift „Listen“, Einleitung,
   leerer Zustand, Dialog zur Art, Erklärung „Liste“, Zeile an der Scheibe „Liste RWK_LP“, Filter „Liste“).
2. **T2 Zugriffe:** `list` an `OverviewCard`, `PageCard` und `ListInputCard` (`withFamily`), Test gegen die Dev-Datenbank
   (Scheibe mit und ohne Rangliste).
3. **T3 Seite einer Scheibe:** `cardMeta(card, timeZone, list)` hängt „Liste <Name>“ an; Markup-Test.
4. **T4 Filter „Liste“:** Abfrage, Adresse (`list`), Modell (Filter, `lists`), Blatt „Filter“, Zusammenfassung, Wege
   (D2); Tests für Adresse (hin und zurück, ungültige Kennung), Modell (Filter, Listen, gewählte bleibt), Markup.
5. **T5 „Listen“:** alle sichtbaren Texte nach dem Textbuch, `OLD_WORDS` mit `Rangliste`, Hilfe „Liste der Scheiben“ →
   „unter Scheiben“; Wortlaut-Tests nachziehen.
6. **T6 Zehntel:** `formatShotValue`, die Stellen aus D4, Zehntelverteilung immer; Tests (Schusstabelle in Ringen zeigt
   10,4 und Spaltenkopf „Wert“, Ablesung, Zeile, Verlauf, Zehntelverteilung in Ringen); Hilfe und `docs` neu erzeugen.
7. **T7 Pausen:** `PAUSE_FACTOR = 2`, Versionen Z1/Z2 auf 4, Texte (Hilfe `pausen`, `rhythmus`, `tempo-und-dauer`,
   `pauseRuleText`, Katalog); Tests mit neuen Werten; Mutationsprobe (Faktor zurück auf 2,5 → Test rot).
8. **T8 Reiterwechsel:** Scrollen nach D6; Prüfung in `pruefen.ts` (tief in einen langen Reiter scrollen, kürzeren
   wählen, Anfang der Karten bei 56 px am Telefon, 112 px am Desktop).
9. **T9 Zeitraum merken:** Cookie lesen und schreiben nach D7; Tests für Lesen (gültig, kaputt, unbekannte Kennung) und
   für die Regel „nur ohne Abfrage“.
10. **T10 Kalender:** Modell mit allen Trainingstagen der Familie und Fenster, Knöpfe nach D8; Tests (Fenster am Ende
    des Zeitraums, früher/später, Grenzen); Prüfung in `pruefen.ts` (Knopf „früher“ zeigt ältere Tage).
11. **T11 Doku:** Scope-Notizen, Katalog (Z1, Z2, Z4, V2), `spiegel-navigation` (Filter „Liste“, gemerkter Zeitraum,
    blätterbarer Kalender).

## Testschritte

- `pnpm check` nach jedem Task.
- Mutationsproben: Faktor der Pausen; Filter „Liste“ ausgeschaltet (Test rot).
- `pnpm --filter spiegel pruefen --start` mit dem Demo-Konto (`seed:own --demo`, danach `seed:own`).
- Browser am Telefon (375 px) und Desktop, Hintergrund-Tab: Seite einer Scheibe (Liste, Zehntel, Reiterwechsel),
  Scheiben mit Filter „Liste“, Fortschritt (gemerkter Zeitraum nach Neuladen ohne Abfrage, Kalender blättern), Admin
  „Listen“.

## Verifikation

Bericht `reports/2026-10-15-spiegel-feedback-1.md`, danach `/review` gegen `main`. Merge durch den User, danach Release
und Deploy (die Projektion von Z1/Z2 rechnet der Server beim Start nach).
