---
id: spiegel-navigation
type: concept
title: "Spiegel — Navigation, Einstieg und Auswahl"
aliases: [navigation-spiegel, einstieg, scheiben-liste-konzept, app-rahmen]
keywords: [navigation, einstieg, startseite, start, scheiben-liste, übersicht, auswahl, auswahlmodus, abend, trainingsabend, einheit, mischabend, familie, blättern, vorige, nächste, zurück, adresse, url, query, deep link, routen, seitenleiste, untere leiste, bottom navigation, scan, offen, bestätigen, eingang, löschen, papierkorb, rückgängig, weiche sperre, löschsperre, grabstein, wiederherstellen, admin, profil, fortschritt, schnitt davor]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-langzeit]]", "[[spiegel-assignment]]", "[[spiegel-mobile]]", "[[spiegel-roadmap]]", "[[spiegel-privacy]]", "[[spiegel-edge-cases]]", "[[navigation-pattern]]"]
---

**TL;DR** Spiegel öffnet auf **Start**: oben „Offen (n)“, darunter der letzte Abend groß, neue Rekorde und eine Zeile zur Form. Daneben stehen die Bereiche **Scheiben** (Liste nach Abend, eine Familie), **Scannen**, **Fortschritt** (Seite eines Zeitraums) und **Profil**. Liste und Fortschritt sind zwei verlinkte Bereiche mit derselben Filterleiste. Eine Auswahl handelt (vergleichen, im Verlauf zeigen, ausnehmen, nicht meine, löschen), sie sammelt nicht. Gelöschtes liegt 30 Tage im Papierkorb; danach hält eine weiche Sperre die Brücke ab, ausdrückliches Holen hebt sie auf. Der ganze Zustand steht in der Adresse, mit englischen Pfaden. Entschieden mit dem User am 9. Oktober 2026; gebaut wird in Schritten N1–N7 ([[spiegel-roadmap]], SP-1.8).

## Ausgangslage

Gebaut sind die Seite einer Scheibe (`CardPage`) und die eines Zeitraums (`PeriodPage`), im Labor verbunden über
„Scheibe öffnen“ und „Zurück zum Zeitraum“ (Zustand im Speicher). Es fehlten der Schritt vor der Scheibe (die
Scheiben als Übersicht und Auswahl), ein Einstieg und ein Rahmen, der die Seiten verbindet. Grundlage war ein
Entwurf mit drei Varianten:

- **A „Scheiben zuerst“:** Start ist die Liste.
- **B „Zeitraum zuerst“:** Die Liste der Zeitraum-Seite ist die Übersicht.
- **C „Start und Bereiche“:** wie [[spiegel-ui-design]].

Gewählt ist C. Gebaut wird zuerst die Liste, weil sie das Rückgrat ist.

## Entschieden mit dem User (9. Oktober 2026)

1. **Einstieg ist Start**, ein eigener Bildschirm:
   - oben „Offen (n)“;
   - darunter der letzte Abend groß: Hauptscheibe mit kleiner Scheibe, Ergebnis, ein Satz gegen den Schnitt, die
     übrigen Scheiben des Abends als Chips;
   - dann „Neue Rekorde“ und „Form, letzte 90 Tage“ → Fortschritt.
   - Läuft gerade eine Scheibe, steht das oben („Läuft · Stand 6 · 23 Schuss“).
2. **Die Liste gliedert sich nach Abend:**
   - Ein Kopf je Abend: Datum, Familie, Zahl der Scheiben und Schüsse, bestes Ergebnis.
   - Darunter die Scheiben; kleine (Aufwärmen, Abbruch) sind eingeklappt (SF-11).
   - Im Modell heißt das „Einheit“ (Konto + Tag, [[spiegel-data-model]]), in der Oberfläche „Abend“.
3. **Ein Abend klappt nur auf.** Er hat keine eigene Seite; eine Zeile öffnet die Scheibe. Eine Abend-Seite kommt
   erst, wenn die Verknüpfung mit Treffsicher sie braucht (SP-3.1).
4. **Liste und Fortschritt sind zwei verlinkte Bereiche:**
   - Beide haben dieselbe Filterleiste und dieselbe Zeile.
   - „Verlauf dieser Filter“ führt von der Liste zum Fortschritt.
   - „Alle in Scheiben zeigen“ führt vom Fortschritt zur Liste, mit Familie, von und bis.
   - Der Fortschritt behält seine kurze Liste mit Ablesung und „Scheibe öffnen“.
5. **Die Familie ist auch in der Liste Pflicht**, wie im Zeitraum ([[spiegel-langzeit]], Prinzip 1). Vorgewählt ist
   die zuletzt benutzte.
6. **Mischabend:** Wurde am Abend auch eine andere Familie geschossen, nennt der Kopf sie: „Do 25.9. · LG · auch
   1 Scheibe LP ›“. Antippen wechselt die Familie und springt zum selben Abend. So bleibt die Liste rein, und kein
   Abend wirkt unbemerkt unvollständig.
7. **Die Auswahl handelt, sie sammelt nicht:**
   - Aktionen: Vergleichen (genau zwei), Im Verlauf zeigen, Aus Verläufen ausnehmen, Nicht meine, Löschen
     (siehe 15).
   - Keine gespeicherten Sammlungen: Zeitraum und Filter bestimmen die Scheiben ([[spiegel-langzeit]],
     Entscheidung 2).
   - Auf dem Telefon über langes Drücken oder „Auswählen“, am Desktop über Kästchen. Im Auswahlmodus ersetzt
     eine Aktionsleiste die untere Navigation.
8. **„Offen“ steht oben auf Start**, mit einem Zähler am Start-Symbol der unteren Leiste:
   - Offen sind: erste Scheibe bestätigen, wartender QR-Scan, „Das war ich“, Nachladen
     ([[spiegel-assignment]]).
   - Eine Seite `/open` listet alles; was erledigt ist, verschwindet.
9. **Blättern im Kontext:**
   - In der Scheibe steht oben „‹ vorige · nächste ›“, in der Reihenfolge, aus der man kam: die Liste mit ihrer
     Familie, der Fortschritt mit seiner Wahl, Start mit dem letzten Abend.
   - Der Rückweg nennt den Kontext: „← Scheiben“, „← Letzte 90 Tage“, „← Start“.
   - Kein Wischen: Es kollidiert mit Zoom und Ausschnitt der Scheibe.
10. **Der ganze Zustand steht in der Adresse, mit englischen Pfaden** (wie Treffsicher `/sessions`):
    - Filter, Zeitraum, Vergleich, Wahl und Herkunft stehen als Query.
    - Browser-Zurück und geteilte Links stellen alles wieder her.
    - Auch die Anker sind englisch (User, 9. Oktober 2026, Nachtrag: „deutsch sieht das seltsam aus“): `#target`,
      `#shots`, `#numbers`, `#analysis`, die Reiter `#overview` … `#sighters`, im Fortschritt `#history`, `#cards`.
      Die Beschriftungen auf der Seite bleiben deutsch.
    - Ids sind erzeugte Ids aus der Datenbank, nie Namen: Scheiben (`[A-Za-z0-9_-]+`, etwa cuid oder UUID) und
      benannte Zeiträume (klein, Ziffern, Bindestriche, nicht `30d`, `90d`, `12m`, `all`, `previous`). Die Familie
      ist die des Fachkerns (`lg-freihand`, `lg-auflage`, `lp-freihand`, `lp-auflage`); Freihand und Auflage sind
      getrennt (SF-65).
11. **Am Desktop eine Seitenleiste** mit denselben Bereichen ab 1024 px, jede Seite in voller Breite daneben. Keine
    Liste neben der Scheibe, keine Kopfzeile nach [[navigation-pattern]].
12. **Nach dem Scan auf die Scheibe:** Vorschau, Bestätigen, dann die Seite der neuen Scheibe. „←“ führt in die
    Liste, die neue Scheibe ist dort markiert.
13. **Ein Schnitt überall: der der bis zu fünf Scheiben davor** derselben Familie, ohne die Scheibe selbst. Das gilt
    wie in der Zeitraum-Seite seit L3 und für Start, Liste, Ablesung und die Kacheln einer Scheibe. Der
    „30-Tage-Schnitt“ aus [[spiegel-ui-design]] entfällt.
14. **Der Bereich heißt „Fortschritt“.** Die Seite zeigt oben ihren Zeitraum („Letzte 90 Tage“).
15. **Eine eigene Scheibe lässt sich löschen, über Papierkorb und weiche Sperre** (User, 9. Oktober 2026, nach
    Rückfrage):
    - **Löschen:** mit Bestätigung, an der Scheibe und in der Auswahl. Sofort steht „Gelöscht · Rückgängig“ da.
    - **Papierkorb:** 30 Tage, unter Profil. Wiederherstellen geht ohne Brücke. In dieser Zeit zählt die Scheibe
      nirgends mit, auch nicht in Rekorden und Verläufen.
    - **Danach endgültig:** Gelöscht werden Rohdaten, Ableitungen und PDF ([[spiegel-privacy]]).
    - **Weiche Sperre statt Grabstein:**
      - Spiegel merkt sich nur den Schlüssel (Quelle, Epoche, ScheibenID), keine Schussdaten, und verteilt ihn an
        die Brücke.
      - Grund: Die Brücke hat keinen eigenen Zustand, gleicht die letzten 30 Tage ab und schickt nach einer
        Korrektur einen neuen Snapshot. Ohne Sperre käme eine Opt-in-Scheibe am nächsten Abend von selbst zurück.
      - **Ausdrückliches Holen** (QR-Scan, „Scheibe holen“, Nachladen) hebt die Sperre auf und bringt die Scheibe
        zurück, solange Meyton sie noch hat.
    - **Grabstein bleibt** für „Nicht meine“ und abgelehnte Scheiben, denn dort geht es um die Daten eines anderen
      (SF-28, SF-37).
    - „Aus Verläufen ausnehmen“ bleibt die sanfte Alternative ohne Löschen.
16. **Admin:** auf dem Telefon ein Eintrag in Profil, am Desktop der letzte Eintrag der Seitenleiste. Nur für
    Admins sichtbar.

## Bereiche und Adressen

| Bereich | Telefon | Desktop | Adresse |
|---|---|---|---|
| Start | untere Leiste, Zähler für Offen | Seitenleiste | `/` |
| Scheiben | untere Leiste | Seitenleiste | `/cards?family=lp-auflage&kind=training&flag=nur-pdf#2026-09-25` |
| Scannen | Mitte der unteren Leiste, erhaben | „QR scannen“, „Link einfügen“ | `/scan` |
| Fortschritt | untere Leiste | Seitenleiste | `/progress?range=12m&compare=previous&family=lg-freihand&sighters=0&pick=<id>#history` |
| Profil | untere Leiste, darin Admin | Seitenleiste | `/profile` |
| Admin | in Profil | letzter Eintrag | `/admin/…` |

Seiten ohne eigenen Bereich:

| Seite | Adresse |
|---|---|
| Scheibe | `/cards/<id>?from=progress&family=lg-freihand&series=2&shot=23#position` |
| Vergleich zweier Scheiben | `/compare?a=<id>&b=<id>` (C2), oder als Zeitraum aus je einer Scheibe ([[spiegel-langzeit]]) |
| Offen | `/open` |
| Papierkorb | `/profile/trash` |

**Werte in der Query:**

- Zeitraum: `90d`, `12m`, `all`, der Name eines benannten Zeitraums oder `2026-05-01..2026-06-30`.
- Familie wie im Katalog: `lg-10m`, `lp-10m`.

Die Schlüssel sind englisch wie die Pfade. Die genaue Form legt N1 fest.

## Umgesetzt in N1 (9. Oktober 2026)

Plan `plans/2026-10-09-spiegel-routen.md`, Branch `feat/spiegel-routen`.

- **`@vereinsheim/shot-ui/nav/routes`:** `Route` für jede Seite, dazu `routeFromUrl(pathname, search, hash)` und
  `urlFromRoute`.
  - Kanonisch: Vorgaben fallen weg, Schlüssel in fester Reihenfolge.
  - Ungültiges gilt als Vorgabe; eine unbekannte Seite ist `unknown` mit ihrem Pfad, nie ein Fehler.
  - Belegt durch zwölf Handwerte und eine Rundreise über mehr als 20 000 Routen.
  - `routeFromHref` liest eine ganze Adresse als Zeichenkette; `isCardId` und `isNamedPeriodId` sagen, welche Ids
    taugen (Review N1).
- **Werte:**
  - `range`: `30d`, `90d` (Vorgabe), `12m`, `all`, `JJJJ-MM-TT..JJJJ-MM-TT` oder die Id eines benannten Zeitraums;
    die festen Werte gehen vor.
  - `compare`: `previous` oder eine Id.
  - Filter: `family`, `kind` (`training`, `competition`), `flag`.
  - Darstellung: `sighters=0` (Training nur aus Probe nicht mitzählen), `scoring=rings`, `metric` (`sigma`, `tens`,
    `tempo`), `view` (`cards`, `months`).
  - Wahl: `pick` mit der Id einer Scheibe.
  - Scheibe: `from` (`list`, `start`, `progress`) mit den Schlüsseln der Herkunft, ohne `pick`, dazu `series`
    (`all`, `match`, `sighters`, Serie bis 999), `shot` (Nummer wie auf der Scheibe, `23`, `P3`). Die Reihenfolge:
    `from` mit den Schlüsseln der Herkunft, dann `series`, `shot`, `scoring`.
  - Anker englisch: `#target`, `#shots`, `#numbers`, `#analysis`, Reiter `#overview` … `#sighters`, Fortschritt
    `#history`, `#cards`; die Liste trägt den Abend (`#2026-09-25`).
- **Nicht in der Adresse:** wie gezeichnet wird (Ebenen, Ausschnitt, Thema, Erklärungen). Das bleibt Einstellung im
  Gerät.
- **`@vereinsheim/shot-ui/nav/navigate`:**
  - `openCard` (die Herkunft trägt ihren Zustand, die Wertung trägt die Scheibe).
  - `backRoute` (zurück mit der Scheibe gewählt), `backLabel` („Letzte 90 Tage“, „Neue Munition“, „Start“,
    „Scheiben“), `siblingRoute` (Blättern behält Herkunft, Wertung und Abschnitt).
  - `listFromProgress` und `progressFromList` (ohne Wertung der Liste gilt die des Geräts, wie bei `openCard`).
  - `progressRoute` und `periodStateFromRoute`; dazu die Aktion `restore` des `periodReducer`.
- **Labor:**
  - Im Artifact kommt nur ein einfacher Anker an. Das Labor zeigt die Adresse deshalb nur an („Adresse in der App“),
    baut den Rückweg aber aus ihr. Die Wertung der Scheibe kommt mit zurück.
  - Eine geöffnete Scheibe übernimmt die Wertung des Zeitraums und beginnt ohne Anker.
  - Die Saison nutzt die Familien des Fachkerns und erzeugte Ids für Scheiben und benannte Zeiträume.
  - Die Skriptprüfung rechnet jede gezeigte Adresse hin und zurück.
- **Für N3 offen:** echte Navigation in einem Router, Browser-Zurück, „‹ vorige · nächste ›“ mit Daten. Der Anker
  des Abends wird in der Liste (N2) gesetzt.

## Umgesetzt in N2 (9. Oktober 2026)

Plan `plans/2026-10-09-spiegel-scheiben-liste.md`, Branch `feat/spiegel-scheiben-liste`.

- **`@vereinsheim/shot-ui/list/evenings`:**
  - `eveningDay`: der Tag in der Anzeige-Zeitzone, eine Scheibe vor 4 Uhr zählt zum Vortag.
  - `cardListModel`: Abende neueste zuerst, Scheiben in zeitlicher Folge, je Zeile Ergebnis, Ø je Schuss, Abstand zum
    Schnitt der bis zu fünf Scheiben davor (`deltasBefore`, wie im Zeitraum) und Schusszahl; dazu andere Familien
    des Abends und die Merkmale der Familie.
- **Bausteine:**
  - `EveningList`: Abschnitt je Abend mit dem ISO-Tag als Anker; die Zeile ist ein Knopf.
  - `ListControls`: Filter, Zeitraum-Chip, „Verlauf dieser Filter“.
  - `CardFilters`: Familie und Art, geteilt mit dem Zeitraum.
  - Im Fortschritt „Alle in Scheiben zeigen“.
- **Labor:** Ansicht „Scheiben“ mit der Saison. Die Luftpistole hat seit N2 Abende mit zwei Scheiben und drei
  Mischabende an Samstagen.
- **Offen, „kleine“ Scheiben (SF-11):** Der User kannte das Konzept nicht (9. Oktober 2026); Einklappen entfällt. Ob
  Nebenscheiben (Einschießen, Neustart, Abbruch) im Verein vorkommen und ob sie im Fortschritt zählen, entscheiden
  wir mit echten Daten (Schießprotokoll, SP-0.6).
- **Für N3:** echte Navigation und Blättern mit Daten; die Zeile wird dann ein Link.

## Was die Bausteine schon haben, was fehlt

- **Wiederverwendbar:**
  - die Zeile aus `CardList` / `CardLine` mit `MiniTarget`;
  - die Filter aus `PeriodControls`;
  - `periodReducer`, `periodSentence`, `PeriodInsights` (Rekorde);
  - `Segmented`, `Sheet`, `ToggleChip`;
  - die Seiten `CardPage` und `PeriodPage`.
- **Neu:**
  - ein Routen-Modell (Adresse ↔ Zustand);
  - Abende als reine Funktion;
  - die Liste als Baustein;
  - untere Leiste und Seitenleiste;
  - der Auswahlmodus;
  - Start.
- **Technisch zu lösen:** Die Pille „Zurück zu …“ (`ReturnPill`) sitzt unten fest und muss über die untere Leiste
  mit erhabenem Scan-Knopf rücken. Der Rückweg zum Fortschritt hängt im Labor am Speicher und muss in die Adresse.

## Schritte (je eine Session, über `/plan`)

| Schritt | Inhalt | Zuordnung |
|---|---|---|
| N1 | **Routen-Modell** als reine Funktionen in `shot-ui`: Adresse ↔ Zustand für Start, Liste, Scheibe, Fortschritt, Herkunft; Tests mit Rundreise | SP-1.8 |
| N2 | **Abende und Scheiben-Liste:** Abende als reine Funktion (Gruppe, Hauptscheibe, „klein“ ab Schwelle, SF-11, Mischabend); die Liste als Baustein (Zeile mit `MiniTarget`, Filterleiste aus `PeriodControls` herausgelöst, Familie Pflicht); im Labor eine dritte Ansicht „Scheiben“ mit der Saison | SP-1.8 |
| N3 | **App-Rahmen in Design 2:** untere Leiste mit Scan, Seitenleiste ab 1024 px, `ReturnPill` über der Leiste. Wechsel Liste ↔ Scheibe ↔ Fortschritt mit Kontext-Zurück und Blättern, „Verlauf dieser Filter“ und „Alle in Scheiben zeigen“ | SP-1.8, Baustein aus [[adr-030]] |
| N4 | **Auswahlmodus:** Vergleichen, Im Verlauf zeigen, Ausnehmen, Nicht meine, Löschen mit Bestätigung und „Rückgängig“. Der Vergleich zweier Scheiben braucht C2 im Fachkern | SP-1.8, SP-2.2 (C2) |
| N5 | **Start im Labor:** Offen als Platzhalter, letzter Abend, Satz gegen den Schnitt der fünf davor, neue Rekorde, Form | SP-1.8 |
| N6 | **Offen mit echten Fällen:** erste Scheibe bestätigen, wartender QR, „Das war ich“, Nachladen | SP-1.7, SP-2.5 |
| N7 | **Routen in `apps/spiegel`** aus N1–N5, mit echten Daten; Papierkorb (30 Tage) und weiche Sperre, an die Brücke verteilt, aufgehoben durch ausdrückliches Holen | SP-1.8 App-Seiten nach SP-1.6, SP-1.5 (Brücke) |

## Skizze

```
Telefon (eine Spalte, untere Leiste immer da, außer im Auswahlmodus)

┌─────────── Start ───────────┐    ┌──────── Scheiben (LG) ───────┐
│ Offen (2)               ›   │    │ [LG ▾] [Art ▾] [Merkmal ▾]   │
│ ┌─ Di 30.9. · LG ────────┐  │    │ Verlauf dieser Filter ›      │
│ │ (◎) 386,4  40+9 Schuss │  │    │ ── Di 30.9. · 2 Scheiben ─── │
│ │ „0,1 über d. Schnitt“  │  │ ─▶ │ (◎) LG 40   386,4   W        │
│ │ + Aufwärmen (8)        │  │    │   + 1 kleine (8 Schuss)      │
│ └────────────────────────┘  │    │ ── Do 25.9. · auch 1 LP › ── │
│ Neue Rekorde ›              │    │ (◎) LG 40   391,0   W        │
│ Form, letzte 90 Tage ›      │    │ … (langes Drücken: Auswahl)  │
├─────────────────────────────┤    ├──────────────────────────────┤
│ Start Scheiben (⌖) Fortschritt Profil    ◀ Scan in der Mitte
└─────────────────────────────┘    └──────────────────────────────┘
        │ Karte                            │ Zeile
        ▼                                  ▼
┌──────── Scheibe (CardPage) ─────────┐   ┌──── Fortschritt (PeriodPage) ────┐
│ ← Scheiben        ‹ vorige nächste ›│   │ Letzte 90 Tage ▾ · LG · vergl. … │
│ Kopf, Ergebnis, Satz                │◀──│ Liste → „Scheibe öffnen“          │
│ Scheibe · Schüsse · Zahlen · Analyse│──▶│ „Alle in Scheiben zeigen“ → Liste │
└─────────────────────────────────────┘   └──────────────────────────────────┘
  Auswahl: [Vergleichen (2)] [Im Verlauf] [Ausnehmen] [Nicht meine] [Löschen]
  Scan ⌖ → Vorschau → Bestätigen → Scheibe (← Liste, neue Scheibe markiert)

Desktop (Seitenleiste ab 1024 px, Seiten in voller Breite)

┌──────────────┬──────────────────────────────────────────────────────────┐
│ Spiegel      │ Scheiben        [LG ▾] [Art ▾] [Merkmal ▾] [Auswählen]   │
│ ▸ Start (2)  │ ── Di 30.9. ── (◎) LG 40  386,4  +0,1  40+9  W   ›       │
│ ▸ Scheiben   │                 + 1 kleine (eingeklappt)                 │
│ ▸ Fortschritt│ ── Do 25.9. · auch 1 LP › ──                             │
│ ⌖ QR scannen │                 (◎) LG 40  391,0          W   ›          │
│ ───────────  │                                                          │
│ ▸ Profil     │                                                          │
│ ▸ Admin      │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```
