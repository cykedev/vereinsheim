---
id: spiegel-navigation
type: concept
title: "Spiegel — Navigation, Einstieg und Auswahl"
aliases: [navigation-spiegel, einstieg, scheiben-liste-konzept, app-rahmen]
keywords: [art der scheibe, wettkampf, training, kindchoice, navigation, einstieg, startseite, start, scheiben-liste, übersicht, auswahl, auswahlmodus, abend, trainingsabend, einheit, mischabend, familie, blättern, vorige, nächste, zurück, adresse, url, query, deep link, routen, seitenleiste, untere leiste, bottom navigation, scan, offen, bestätigen, eingang, löschen, papierkorb, rückgängig, weiche sperre, löschsperre, grabstein, wiederherstellen, admin, profil, fortschritt, schnitt davor, wertung, zehntel, ganze ringe, wertung der scheibe, wertung der familie, wie am stand, amtliche wertung, liste aus meyton, rangliste, filter liste, zeitraum merken, gemerkter zeitraum, kalender blättern, früher, später, darstellung, cookie]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-langzeit]]", "[[spiegel-assignment]]", "[[spiegel-mobile]]", "[[spiegel-roadmap]]", "[[spiegel-privacy]]", "[[spiegel-edge-cases]]", "[[spiegel-durchsicht]]", "[[navigation-pattern]]"]
---

**TL;DR** Spiegel öffnet auf **Start**: „Offen (n)“, je Familie der letzte Abend groß (Satz, Formband, Kacheln, neue
Rekorde) und die Form der letzten 90 Tage. Daneben stehen die Bereiche **Scheiben** (Liste nach Abend, eine Familie),
**Fortschritt** (Seite eines Zeitraums) und **Profil**; **Scannen** kommt mit dem QR-Weg (SP-1.7 b). Liste und
Fortschritt sind zwei verlinkte Bereiche mit derselben Filterzeile und derselben Familie. Wertung und Art gehören zur
Scheibe bzw. Familie und werden beim Umschalten gespeichert. Gelöschtes liegt 30 Tage im Papierkorb, danach hält eine
weiche Sperre die Brücke ab. Der ganze Zustand steht in der Adresse, mit englischen Pfaden. Offen sind vor allem die
Auswahl, Scannen und der Vergleich zweier Scheiben.

## Konzept

Spiegel folgt dem Aufbau „Start und Bereiche“ aus [[spiegel-ui-design]]: ein eigener Einstieg, daneben Bereiche wie
Reiter einer App; das Rückgrat ist die Liste der Scheiben. Die Seiten einer Scheibe (`CardPage`) und eines Zeitraums
(`PeriodPage`) hängen über Adressen und Links zusammen.

- **Die Liste gliedert sich nach Abend.** Im Modell heißt das „Einheit“ (Konto + Tag, [[spiegel-data-model]]), in der
  Oberfläche „Abend“. Ein Abend hat keine eigene Seite; eine Zeile öffnet die Scheibe. Eine Abend-Seite kommt erst, wenn
  die Verknüpfung mit Treffsicher sie braucht (SP-3.1).
- **Liste und Fortschritt sind zwei verlinkte Bereiche:**
  - Beide haben dieselbe Filterzeile: Familie und ein Chip, der das Blatt „Filter“ öffnet.
  - „Im Fortschritt zeigen“ (im Blatt „Filter“ der Liste) führt in den Fortschritt, „Alle in Scheiben zeigen“ zurück in
    die Liste, mit Familie, von und bis.
  - Der Fortschritt behält seine kurze Liste mit Ablesung und „Scheibe öffnen“.
- **Die Familie ist Pflicht**, in der Liste wie im Fortschritt ([[spiegel-langzeit]], Prinzip 1). Vorgewählt ist die
  zuletzt benutzte; sie bleibt beim Wechsel zwischen Scheiben und Fortschritt, auch über die Navigation. Freihand und
  Auflage sind getrennte Familien (SF-65).
- **Ein Schnitt überall:** der der bis zu fünf Scheiben davor derselben Familie, ohne die Scheibe selbst, in Start,
  Liste, Fortschritt und Ablesung. Einen „30-Tage-Schnitt“ gibt es nicht.
- **Der Bereich heißt „Fortschritt“.** Die Seite zeigt oben ihren Zeitraum („Letzte 90 Tage“).
- **Eine Auswahl handelt, sie sammelt nicht:** Es gibt keine gespeicherten Sammlungen, Zeitraum und Filter bestimmen
  die Scheiben ([[spiegel-langzeit]], Entscheidung 2). Gebaut ist die Auswahl noch nicht (siehe „Was noch fehlt“).
- **Der ganze Zustand steht in der Adresse, mit englischen Pfaden** (wie Treffsicher `/sessions`): Filter, Zeitraum,
  Vergleich, Wahl und Herkunft stehen als Query; Browser-Zurück und geteilte Links stellen alles wieder her.

## Bereiche und Adressen

| Bereich | Telefon | Desktop | Adresse |
|---|---|---|---|
| Start | untere Leiste, Zähler für Offen | Seitenleiste, Zähler für Offen | `/` |
| Scheiben | untere Leiste | Seitenleiste | `/cards?family=lp-auflage&kind=training&flag=nur-pdf#2026-09-25` |
| Fortschritt | untere Leiste | Seitenleiste | `/progress?range=12m&compare=previous&family=lg-freihand&sighters=0&pick=<id>#history` |
| Profil | untere Leiste, darin Admin | Seitenleiste | `/profile` |
| Admin | in Profil, nur für Admins | letzter Eintrag der Seitenleiste, nur für Admins | `/admin/…` |
| Scannen | nicht in der Navigation bis zum QR-Weg (SP-1.7 b) | ebenso | `/scan` (Platzhalter) |

Seiten ohne eigenen Bereich:

| Seite | Adresse |
|---|---|
| Scheibe | `/cards/<id>?from=progress&family=lg-freihand&series=2&shot=23#position` |
| Offen | `/open` |
| Papierkorb | `/profile/trash` |
| Vergleich zweier Scheiben | `/compare?a=<id>&b=<id>`: kennt das Routen-Modell, eine Seite gibt es noch nicht (C2, SP-2.2); ein Vergleich als Zeitraum aus je einer Scheibe steht in [[spiegel-langzeit]] |

## Routen-Modell

**`@vereinsheim/shot-ui/nav/routes`:** `Route` für jede Seite, dazu `routeFromUrl(pathname, search, hash)`,
`urlFromRoute` und `routeFromHref` (eine ganze Adresse als Zeichenkette). Seiten bauen Adressen und Wege nur hierüber
und über `nav/navigate`.

- **Kanonisch:** Vorgaben fallen weg, Schlüssel stehen in fester Reihenfolge. Ungültiges gilt als Vorgabe; eine
  unbekannte Seite ist `unknown` mit ihrem Pfad, nie ein Fehler. Belegt durch zwölf Handwerte und eine Rundreise über
  mehr als 20 000 Routen.
- **Ids** sind erzeugte Ids aus der Datenbank, nie Namen (`isCardId`, `isNamedPeriodId`): Scheiben (`[A-Za-z0-9_-]+`,
  etwa cuid oder UUID) und benannte Zeiträume (klein, Ziffern, Bindestriche, nicht `30d`, `90d`, `6m`, `12m`, `all`,
  `previous`). Die Familie ist die des Fachkerns (`lg-freihand`, `lg-auflage`, `lp-freihand`, `lp-auflage`).
- **Werte:**
  - `range`: `30d`, `90d` (Vorgabe), `6m`, `12m`, `all`, `JJJJ-MM-TT..JJJJ-MM-TT` oder die Id eines benannten Zeitraums; die
    festen Werte gehen vor. In der Liste heißen `all` und ohne Angabe dasselbe: alle Abende.
  - `compare`: `previous` oder eine Id.
  - Filter: `family`, `kind` (`training`, `competition`), `flag`; in der Liste dazu `list` (Kennung der Liste aus
    Meyton, nie ihr Name).
  - Darstellung im Fortschritt: `sighters=0` (Training nur aus Probe nicht mitzählen), `metric` (`sigma`, `tens`,
    `tempo`), `view` (`cards`, `months`). `scoring=rings` kennt das Modell; die App rechnet den Fortschritt in der
    Wertung der Familie und übergeht es.
  - Wahl: `pick` mit der Id einer Scheibe (im Fortschritt die gewählte, in der Liste die markierte).
  - Scheibe: `from` (`list`, `start`, `progress`) mit den Schlüsseln der Herkunft, ohne `pick` und ohne deren Wertung;
    dann `series` (Serie bis 999; die ganze Scheibe ist die Vorgabe und fehlt), `shot` (Nummer wie auf der Scheibe,
    `23`), `scoring`.
  - Anker englisch, die Beschriftungen auf der Seite deutsch: Scheibe `#target`, `#shots`, `#analysis`, Reiter
    `#overview`, `#result`, `#precision`, `#position`, `#time`; Fortschritt `#history`, `#cards`, `#numbers`,
    `#analysis`; die Liste trägt den Abend (`#2026-09-25`).
- **Nicht in der Adresse:** wie gezeichnet wird (Ebenen, Ausschnitt, Thema, Erklärungen). Das bleibt Einstellung im
  Gerät.

**`@vereinsheim/shot-ui/nav/navigate`:**

- `openCard`: Die Herkunft trägt ihren Zustand; ohne Rekord keine Wertung, die Scheibe öffnet in ihrer.
- `backRoute`: zurück in die Liste mit der Scheibe als `pick`, in den Fortschritt mit ihr gewählt (ohne Wertung), nach
  Start; von einem direkten Link in die Liste. `backLabel` nennt den Rückweg: „Letzte 90 Tage“, „Neue Munition“,
  „Start“, „Scheiben“.
- `siblingRoute`: Blättern behält Herkunft und Abschnitt, nicht den Reiter und nicht die Wertung; die nächste Scheibe
  öffnet in ihrer.
- `listFromProgress` und `progressFromList` für die Querverweise, `listOnEvening` für den Sprung an einen Abend einer
  anderen Familie.
- `progressRoute` und `periodStateFromRoute`; dazu die Aktion `restore` des `periodReducer`.

## App-Rahmen

- **`AppFrame`** (`shot-ui`):
  - Ab 1024 px eine Seitenleiste: „Spiegel“, Start mit Zähler, Scheiben, Fortschritt, Profil, Admin als letzter
    Eintrag. Jede Seite steht in voller Breite daneben; keine Liste neben der Scheibe, keine Kopfzeile nach
    [[navigation-pattern]].
  - Unter 1024 px eine untere Leiste. Ohne Scannen (`scan={false}`) hat sie vier Felder; mit Scannen fünf, Scannen erhaben in
    der Mitte, und die Seitenleiste nennt „QR scannen“.
  - Telefon quer (unter 500 px hoch): eine schmale Leiste links. Eine untere Leiste nähme dort 72 von 375 px, die
    Scheibe passte nicht mehr unter die Sprungleiste.
  - Admin sieht nur ein Admin; auf dem Telefon steckt Admin in Profil, und ist Admin offen, ist dort Profil markiert.
  - Platz der Leiste: `--app-bar` (72 px). Die Pille „Zurück zu …“ (`ReturnPill`), der Abstand der Seite und die Größe
    der Scheibe richten sich danach.
  - Der Inhalt ist `<main>` und steht vor der unteren Leiste; im Querformat bleibt der sichere Rand frei. Die Leisten
    haben keine Schrift unter `text-xs`.
  - **Darstellung** (System, Hell, Dunkel) ist eine Einstellung der App: in Profil, am Desktop zusätzlich unten in der
    Seitenleiste (`AppFrame.sidebarFooter`), neben der Navigation, nicht in ihr.
- **`AppShell`** (Client, `apps/spiegel`) legt `AppFrame` um jede Seite der Gruppe `(app)`:
  - Links sind `next/link`, Klicks laufen über den Router (`RouteLinkProvider` mit `next/link` als Komponente zum
    Vorladen und `navigate = (route) => router.push(urlFromRoute(route))`). Ohne `navigate` lädt ein Klick auf eine
    ganze Zeile der Liste die Seite neu.
  - Der Bereich kommt aus der Adresse (`areaOf`), Unterseiten von Admin zählen zu Admin.
  - **Bereiche merken sich ihren Zustand** wie Reiter (`areaLinks`): die letzte Adresse von Scheiben (ohne Abend und
    ohne `pick`) und Fortschritt, dazu die zuletzt gewählte Familie, die beide teilen. Wechselt die Familie, fällt die
    Wahl im Fortschritt weg; trug die gemerkte Adresse keine Familie (der Server hat sie aufgelöst), bleibt sie.
  - Das Blatt der Hilfe öffnet jede Seite über `useHelp`; der Hinweis „Rückgängig“ (`useUndo`) steht im Rahmen über der
    unteren Leiste.
- **Links statt Rückrufe:** `RouteLink` mit der Adresse aus `urlFromRoute` für Zeile der Liste, Hinweis auf andere
  Familien, „Im Fortschritt zeigen“, „Alle in Scheiben zeigen“, „Scheibe öffnen“, Rückweg, Blättern und Navigation. Ein
  gesperrter Schritt ist ein gesperrter Link.
- **Seiten auf der Projektion:** Start, Liste und das Blättern lesen die Scheiben mit Projektion (`ownerCards`) und
  rechnen auf dem Server; an den Browser gehen das Modell und die Lagen der gezeigten Scheiben ([[adr-031]],
  [[spiegel-db-schema]]).

## Start

`StartPage` im Raster der Seite eines Zeitraums: links je Familie des letzten Abends ein Block, rechts „Offen“ und die
Form; auf dem Telefon Offen, Abend, Form untereinander.

- **„Offen (n)“** oben (`OpenBox`, siehe „Offen“).
- **Der Block** (`EveningBlock`), je Familie des letzten Abends:
  - die Disziplin als Überschrift mit dem Symbol der Disziplinen, Tag und Umfang daneben;
  - der Satz: „Im Formband: 0,09 über deinem Schnitt.“, „Über dem Formband: …“, „Unter dem Formband: …“; er ordnet ein
    und wertet nicht;
  - der Ø je Schuss des Abends groß (über alle Wertungsschüsse, nicht das Mittel der Mittel), darunter der Bezug
    „Schnitt der 5 Scheiben davor: 9,05“; daneben die Wertung der Familie als Kreis (siehe „Art und Wertung als
    Symbole“);
  - das Formband als kleiner Verlauf der letzten 20 Scheiben (`FormStrip`): Zeit nach rechts, Band um den gleitenden
    Schnitt, der Abend rechts groß mit Datum, in einem Rahmen, darunter eine Zeile, die Punkte, Linie und Band erklärt;
  - die Scheiben als Kacheln (12,5 rem breit, kleine Scheibe 56 px), das Ergebnis mit Namen der Wertung („18,8 Zehntel ·
    18 ganze Ringe“);
  - neue Rekorde, nur wenn der Abend welche aufgestellt hat, höchstens fünf in der Reihenfolge des Katalogs, darunter
    „Noch N weitere Rekorde im Fortschritt ›“ (Fortschritt, Abschnitt Analyse, dort „Alle Rekorde“ aufgeklappt);
  - „Abend in Scheiben ›“.
- **Form:** „Form der letzten 90 Tage“ für die zuletzt gewählte Familie als Titel und ein Satz („Luftgewehr: Ø 10,25 je
  Schuss, deutlich besser als in den 90 Tagen davor (+0,15).“), mit Link in den Fortschritt (`FormLine`).
- **Einheit ist die Scheibe** (Regel des Fachkerns): Der Verlauf zeigt Scheiben, nicht Abende.
- **Das Band** ist das des Verlaufs im Fortschritt über alle Scheiben der Familie, an der letzten Scheibe des Abends und
  mit ihr gerechnet. Start und Fortschritt sagen so dasselbe. Ein Band nur aus den Scheiben davor wäre für einen neuen
  Abend zu schmal: Ein gewöhnlicher Abend fiele in vier von zehn Fällen heraus, und Start widerspräche dem Fortschritt
  (13 von 103 Abenden). Deshalb ordnet der Satz nur ein.
- **Wege:** Eine Kachel öffnet die Scheibe mit Herkunft Start („← Start“). Blättern geht durch die Scheiben des letzten
  Abends, über alle Familien.

## Offen

- „Offen (n)“ steht oben auf Start, die Zahl auch am Start-Symbol; sie zählt SportpassIDs mit wartenden Scheiben.
- Gebaut ist der erste Fall, die erste Scheibe bestätigen ([[spiegel-assignment]]): je Nummer ein Eintrag „Ist das deine
  Scheibe?“; `/open` zeigt je Nummer die jüngste wartende Scheibe und fragt „Ja, meine“ / „Nicht meine“. Was erledigt
  ist, verschwindet.
- Weitere Fälle stehen unter „Was noch fehlt“.

## Scheiben-Liste

- **`@vereinsheim/shot-ui/list/evenings`:**
  - `eveningDay`: der Tag in der Anzeige-Zeitzone, eine Scheibe vor 4 Uhr zählt zum Vortag.
  - `cardListModel`: Abende neueste zuerst, die Scheiben eines Abends ebenso, je Zeile Ergebnis in beiden Wertungen, Ø je
    Schuss, Abstand zum Schnitt der bis zu fünf Scheiben davor (`deltasBefore`, wie im Zeitraum) und Schusszahl; dazu
    andere Familien des Abends, die Merkmale und die Listen aus Meyton der Familie.
- **Form:** wie die Liste eines Zeitraums (`EveningList`). Je Monat eine Karte mit Kopf („September 2026“, Zahl der
  Scheiben und Schüsse) und einer Tabelle (Datum, kleine Scheibe, Uhrzeit, Art, Ergebnis, Ø je Schuss, zum Schnitt,
  Schuss). Ein Abend ist eine Gruppe von Zeilen mit dem ISO-Tag als Anker: Das Datum steht einmal, ohne eigenen Kopf und
  ohne Zahl je Abend. Alle Scheiben eines Abends stehen gleichberechtigt da, nichts ist eingeklappt.
- **Mischabend:** Wurde am Abend auch eine andere Familie geschossen, steht darunter eine kleine, rechtsbündige Zeile
  („auch 1 Scheibe Luftpistole ›“). Antippen wechselt die Familie und springt zum selben Abend. So bleibt die Liste rein,
  und kein Abend wirkt unbemerkt unvollständig. Der Hinweis zählt ohne Art, Merkmal und Liste, nur im Zeitraum; der
  Sprung (`listOnEvening`) lässt sie deshalb fallen, so steht der versprochene Abend sicher in der Liste.
- **Ergebnis in beiden Wertungen:** Spalten „Ganze Ringe“ und „Zehntel“, die Wertung der Scheibe fett (siehe „Wertung
  je Scheibe und je Familie“) und im Namen des Links. Meyton liefert die Anzeigeart je Treffer (`Treffer.Wertung` seit
  ShootMaster 5.2, [[meyton-ssmdb2]]). Ø und Abstand stehen für die ganze Liste in der Wertung der Familie, damit die
  Spalte vergleichbar bleibt.
- **Filter** (`ListControls`): eine Zeile mit Familie und Chip, danach der Wechsel-Chip der Wertung. Das Blatt „Filter“
  wirkt bei jeder Wahl sofort und bleibt offen, man sieht die Liste dahinter wechseln. Darin Art, Liste aus Meyton,
  Merkmal, der Zeitraum (mit „entfernen“) und „Im Fortschritt zeigen“.
  - Ein gewähltes Merkmal bleibt wählbar, auch wenn die Familie es nicht hat; sonst ließe es sich nicht lösen.
  - **Liste aus Meyton:** `ListQuery.list` als Kennung (`list=<id>`), am Chip „Liste RWK_LP“. Eine gewählte Liste bleibt
    wählbar, auch ohne Scheibe der Familie; eine unbekannte Kennung gilt als keine. Der Sprung an einen Abend einer
    anderen Familie und „Alle in Scheiben zeigen“ lassen sie fallen, das Blättern in einer Scheibe behält sie
    (Herkunft).
- **Listen statt Ranglisten:** Die `Rangliste` aus Meyton heißt in jeder sichtbaren Zeile „Liste“ (Admin, Dialog,
  Erklärung, Seite einer Scheibe, Filter); `OLD_WORDS` hält „Rangliste“ fern. Scheiben aus dem PDF oder aus `seed:own`
  haben keine.
- **Familie in der App:** ohne Angabe die der neuesten Scheibe; die Navigation hängt die zuletzt gewählte an.
- **Barrierefrei:** Jede Zeile nennt ihre Werte mit Bedeutung als Namen des Links für Screenreader. Den Kopf der Seite
  zeichnet `ListHeader`, die Abende sind Überschriften zweiter Ebene.

## Markierung beim Sprung in die Liste

Die Liste markiert, wohin man kommt, wie der Fortschritt seine Wahl (`bg-accent-wash`):

- **Abend aus dem Anker** (von Start „Abend in Scheiben ›“, vom Hinweis auf andere Familien, vom Kalender): Seine
  Zeilen sind markiert. Die App liest den Anker im Browser, der Server sieht ihn nicht.
- **Scheibe über `pick`** (`/cards?…&pick=<id>`):
  - Gesetzt vom Rückweg „← Scheiben“ aus einer Scheibe und von „Alle in Scheiben zeigen“ mit einer Wahl im Fortschritt.
  - Die Zeile ist markiert, trägt `aria-current` und steht in der Mitte des Fensters.
  - Ein Filter, „Im Fortschritt zeigen“ und der Wechsel der Bereiche lassen `pick` fallen.
  - Wer eine Scheibe aus der Liste öffnet, schreibt sie vorher als `pick` in die Adresse der Liste (`replaceState`):
    Zurück im Browser markiert dann sie.
- **Aus `location`:** Anker und `pick` liest die Hülle über `useSyncExternalStore` aus der Adresse im Browser, beim
  Hydrieren gilt die Abfrage vom Server. `useSearchParams` reicht nicht: Nach Zurück stellt Next die gespeicherte Seite
  mit ihrer alten Abfrage her. Die Navigation API meldet einen Wechsel synchron, auch aus dem `useInsertionEffect`, in
  dem Next die Adresse schreibt; dort darf React nicht neu zeichnen („useInsertionEffect must not schedule updates“),
  deshalb erst im nächsten Microtask.

## Blättern im Kontext

- **Rückweg und Blättern** (`CardContextBar`): Oben in der Scheibe steht der Rückweg mit Namen („← Scheiben“, „← Letzte
  90 Tage“, „← Start“) und „‹ vorige · nächste ›“.
- **Reihenfolge:** die, aus der man kam (`contextCardIds`), in zeitlicher Folge; vorige ist die ältere. Die Liste mit
  ihrer Familie und ihren Filtern, der Fortschritt mit seiner Wahl, Start mit dem letzten Abend. Am Ende ausgegraut.
- Ohne Familie in der Herkunft blättert die Scheibe in ihrer eigenen Familie. Ein direkter Link hat keine Herkunft und
  kein Blättern; sein Rückweg führt in die Liste.
- Die Scheibe selbst bleibt in ihrem Kontext, auch wenn sie nach dem Umstellen der Art nicht mehr zum Filter der Herkunft
  passt; sonst risse das Blättern aus einer Liste „Training“ ab.
- **Kein Wischen:** Es kollidiert mit Zoom und Ausschnitt der Scheibe.
- **Eine Scheibe beginnt in der Analyse immer mit dem ersten Reiter**, ob geöffnet oder geblättert; es gibt keinen
  gemerkten Reiter. Beim Blättern bleibt der Abschnitt, der Reiter nicht.
- Blättern hängt die Seite neu ein (`key={card.id}`) und liest den Anker nur auf der eigenen Adresse (`useHash`).

## Seite einer Scheibe

- `/cards/<id>`: Wertung, Serie und Schuss aus der Adresse und dorthin zurück, Reiter im Anker, Rückweg und Blättern im
  Kontext der Herkunft vom Server.
- **Metazeile** unter dem Titel mit der Liste aus Meyton („Wettkampf · Liste RWK_LP · Sa 26.09.2026 · 10:30“,
  `cardMeta`).
- **Reiterwechsel an den Anfang:** Ein anderer Reiter der Analyse beginnt oben, die Karten unter den klebenden Leisten
  (56 px am Telefon, 112 px ab 768 px), gemessen an der Reiterleiste. „Alle Beobachtungen“ springt weiter zu seiner
  Karte.
- **Keine Katalog-IDs** („E1 · E2“) im Kopf der Analyse-Karten; der Katalog steht im Leitfaden (`shot-help`).
- Tippen und Ziehen in Diagrammen und auf der Scheibe markiert keinen Text (auch in Safari, das `user-select` nur mit
  Präfix kennt).
- **Darstellung der Scheibe** (Ebenen, übrige blass/aus, Ausschnitt) als Cookie `spiegel-target`, nicht in
  `localStorage`: Den Cookie liest der Server, die Scheibe steht schon im ersten Bild richtig. Aus `localStorage` käme
  sie erst nach dem Hydrieren, jede Scheibe spränge beim Öffnen von der Vorgabe auf die eigene Darstellung.
  - Geschrieben nur beim Umschalten, nie beim Öffnen: Nach Zurück und Vor bringt Next die Seite aus dem Cache mit der
    Darstellung ihres ersten Besuchs, ein Schreiben beim Öffnen überschriebe die zuletzt gewählte.
  - Eine Seite aus dem Cache übernimmt die gemerkte über `useSyncExternalStore` (beim Hydrieren gilt die vom Server).
- Löschen am Ende der Seite, siehe „Löschen und Papierkorb“.

## Fortschritt

`/progress` zeigt die Seite eines Zeitraums ([[spiegel-langzeit]]) mit den eigenen Scheiben.

- **Rechnen:** Der Server liest die Abfrage aus der Adresse und rechnet `periodModel` aus den Projektionen
  (`progressPageData` in `src/lib/overview.ts`), in der Wertung der Familie. An den Browser geht das leichte Modell
  (`lightPeriodModel`: Scheiben ohne Werte und Rekorde ihrer Projektion, die Kennzahl ohne Rechnung).
- **Filter schreiben die Adresse:** Zeitraum, Vergleich, Familie, Art, „nur Probe“, Kennzahl und Darstellung; die Seite
  rechnet neu. Das Blatt „Filter“ sammelt die Wahl und wendet sie erst mit „Übernehmen“ an, weil Zeitraum, Vergleich und
  Art zusammen eine Rechnung ergeben und „Frei“ zwei Tage braucht, bevor es gilt.
- **Filter ohne Sprung:** `router.push` mit `scroll: false` in einer Transition. Die Schalter stehen im Verlauf, der ab
  768 px klebt.
- **Die Wahl bleibt im Browser:** Verlauf, Liste oder Rekord ändern nur die Ablesung, ohne Weg zum Server. `pick` geht
  erst in die Adresse, wenn die Wahl 250 ms ruht, und nie während eine Navigation läuft: Das Lineal meldet jede
  Bewegung, und Browser begrenzen `replaceState`. Die kleine Scheibe der Ablesung holt ihre Lagen nach
  (`cardMarksAction`, ebenfalls verzögert); bis dahin steht ein leerer Platz. Beim Laden gilt `pick` der Adresse, auch
  nach Zurück im Browser.
- **Zeitraum gemerkt:** Ein im Blatt „Filter“ übernommener Zeitraum steht im Cookie `spiegel-period` (Form von `range`,
  ein Jahr, je Gerät). `/progress` ohne eigene Abfrage, also nur mit der Familie aus der Navigation, öffnet darin. Links
  mit eigener Abfrage (Start „Form“, „Im Fortschritt zeigen“, Rückweg einer Scheibe) gelten, wie sie sind. Ein benannter
  Zeitraum, den es nicht mehr gibt, fällt auf die Vorgabe zurück.
- **Kalender blätterbar** (`calendarWindow`, `CalendarBrowser`): Der Kalender kennt alle Trainingstage der Familie in
  der Art. Er zeigt so viele ganze Wochen, wie nebeneinander passen (gemessen; am Telefon rund 18, am Desktop rund 35),
  am Anfang bis zum Ende des Zeitraums, nie über heute hinaus. „‹ früher“ und „später ›“ blättern um diese Zahl Wochen,
  begrenzt durch die erste Scheibe und heute; auch bei „Alles“ scrollt er nicht seitlich. Tage außerhalb des Zeitraums
  stehen blass da, die Zeile darunter zählt dann nur den Zeitraum („… im Zeitraum“). Ein Tag außerhalb des Zeitraums
  führt in die Liste ohne Zeitraum.
- **Bedienung über dem Verlauf** (`PeriodChartBar`): Kennzahl, Darstellung und „?“ in einer Zeile, wenn sie passen;
  sonst die Kennzahl oben, darunter die Darstellung links und das „?“ rechts. Gemessen an der Karte, nicht am Fenster.
- **„Erklärungen“** über der Analyse schaltet ihre Kurzsätze an, wie auf der Seite einer Scheibe.

## Löschen und Papierkorb

Eine eigene Scheibe lässt sich löschen, über Papierkorb und weiche Sperre ([[spiegel-privacy]]):

- **Löschen:** mit Bestätigung (Dialog mit Folgen), am Ende der Seite einer Scheibe (`DeleteCard`). Danach geht es den
  Rückweg zurück, dort steht „Scheibe gelöscht · Rückgängig“ (`useUndo`).
- **Papierkorb:** 30 Tage, unter Profil (`/profile/trash`), mit „Wiederherstellen“ und „Endgültig löschen“.
  Wiederherstellen geht ohne Brücke. In dieser Zeit zählt die Scheibe nirgends mit, auch nicht in Rekorden und
  Verläufen. Eine alte Adresse einer gelöschten Scheibe führt in den Papierkorb (`ownCardState`).
- **Danach endgültig:** `purgeExpiredTrash` löscht beim Start des Servers und stündlich Rohdaten, Ableitungen und PDF.
- **Weiche Sperre statt Grabstein** (`DeleteLock`):
  - Spiegel merkt sich nur den Schlüssel (Quelle, Epoche, ScheibenID), keine Schussdaten, und verteilt ihn an die
    Brücke.
  - Grund: Die Brücke hat keinen eigenen Zustand, gleicht die letzten 30 Tage ab und schickt nach einer Korrektur einen
    neuen Snapshot. Ohne Sperre käme eine Opt-in-Scheibe am nächsten Abend von selbst zurück.
  - Ein ausdrückliches Holen (QR-Scan, „Scheibe holen“, Nachladen) soll die Sperre aufheben und die Scheibe
    zurückbringen, solange Meyton sie noch hat; gebaut ist das nicht (siehe „Was noch fehlt“).
- **Grabstein** für „Nicht meine“ und abgelehnte Scheiben, denn dort geht es um die Daten eines anderen (SF-28, SF-37).
  Meldungen „nicht meine“ einer Nummer hebt ein Admin am Konto auf (`liftNotMine`); die Scheiben kommen wartend wieder.
- Der Papierkorb zeigt auch, was nicht von selbst wiederkommt: eigene endgültig gelöschte Scheiben und eigene Meldungen
  „nicht meine“.

## Wertung je Scheibe und je Familie

Es gibt keine Wertung des Geräts: Die Wertung hängt an der Disziplin, lässt sich je Scheibe umstellen und wird
automatisch gespeichert.

- **Wertung einer Scheibe:** gewählt, sonst die Wertung der Disziplin (Admin → Disziplinen, Vorgabe für Training und
  Wettkampf; im Wettkampf die amtliche, so druckt Meyton, SF-74), sonst wie am Stand, ohne alles Zehntel. Die Art der
  Scheibe ändert die Wertung nicht; „amtlich“ nennt der Umschalter sie nur im Wettkampf.

  „Wie am Stand“ ist die häufigste Anzeigeart der Schüsse wie am Ausdruck (`Treffer.Wertung`, 1 und 7 Zehntel, 2 und 8
  ganze Ringe, [[meyton-ssmdb2]]); bei Gleichstand die des letzten Schusses. Andere Codes (Teiler, verdeckt) zählen
  nicht.
- **Wertung einer Familie** für die Schnitte: gespeichert, sonst die häufigste ihrer Scheiben, bei Gleichstand Zehntel.
  In ihr rechnen in der Liste Ø und Abstand, auf Start jeder Block (Ø des Abends, Schnitt, Band, Verlauf, Rekorde) und
  die Form, der Fortschritt.
- **Vorn in Liste und Start** steht die Wertung der Scheibe, in der Liste fett und im Namen des Links. Die große Zahl
  auf Start zeigt die Wertung ihres Blocks im Kreis daneben, weil Blöcke verschiedener Familien verschieden rechnen
  können.
- **Jedes Umschalten ist eine Wahl:** Jedes Tippen stellt um; wer einmal hin und zurück tippt, hat die Wertung gewählt,
  und die Scheibe folgt danach nicht mehr der Vorgabe ihrer Art. Einen Weg zurück zur Vorgabe gibt es nicht, und er ist
  nicht vorgesehen.
- **Umschalten speichert:**
  - Auf der Seite einer Scheibe die Wertung der Scheibe. Liste und Start zeigen sie danach vorn.
  - In Liste und Fortschritt (Wechsel-Chip in der Zeile der Filter) und auf Start (Kreis je Block neben der großen Zahl)
    die Wertung der Familie; danach rechnet die Seite neu. Profil hat keine Wertung.
  - Eine Fehlermeldung gilt nur für ihre Familie: Nach dem Wechsel der Familie steht sie nicht mehr da.
- **Adresse:** Die Seite einer Scheibe trägt `scoring` nur, solange die gezeigte Wertung nicht die der Scheibe ist (ein
  Rekord öffnet in der Wertung, in der er steht). Ohne Angabe gilt die der Scheibe; Liste, Start, Fortschritt und
  Blättern öffnen ohne. Der Fortschritt hat keine Wertung in der Adresse.

## Art der Scheibe

- **Quelle und Wahl:** Die Art der Quelle (`Card.kind`: der Adapter aus `Status` der SSMDB2, `seed:own` „Training“) und
  die Wahl des Schützen (`Card.kindChoice`); neue Lesungen der Brücke schreiben nur die Quelle.
- **Es gilt** die Wahl, ohne Wahl die Art der Liste aus Meyton (`Rangliste`), die der Admin zugeordnet hat (Admin →
  „Anlage und Brücken“), sonst die Quelle. `Status` der SSMDB2 ist an der Vereinsanlage leer ([[meyton-ssmdb2]]); eine
  Liste ohne Zuordnung gilt als Training.
- **Was folgt:** Filter „Art“ in Liste und Fortschritt, der Pokal in der Liste, die Metazeile der Scheibe, die Rekorde
  „nur Wettkampf“ und ob der Umschalter die Wertung „amtlich“ nennt. Die Wertung selbst ändert die Art nicht.
- **Bedienung:** auf der Seite einer Scheibe als Pokal im weichen Kreis (siehe unten), automatisch gespeichert wie die
  Wertung. Eine Scheibe nur aus Probe ist Training und
  hat keinen Schalter; bei ihr zählt auch die Liste nicht.
- Mehrere Scheiben auf einmal umzustellen braucht die Auswahl (siehe „Was noch fehlt“).

## Art und Wertung als Symbole

Neben einer Zahl stehen Art und Wertung als weiche Kreise, in einer Filterzeile als Chip in Worten.

- **Ein Baustein:** `RoundToggle` (`@vereinsheim/ui/design2/round-toggle`), 32 px, innen die Kartenfläche (hell weiß)
  mit Rahmen `line-strong`: auf der grauen Seite ein klarer Knopf, auf der Karte ein Ring. Gold (Token `gold`: hell
  `#a87800`, dunkel `#f1c453`) auf `gold-wash` (die goldene Tönung deckend auf der Kartenfläche) mit Rahmen `gold-line`,
  nur für das Hervorgehobene.
  - Warum so: Ohne Rahmen verschwände der Kreis auf der grauen Seite. Eine eigene Fläche (`surface-2`) wäre auf der Karte
    ein Fleck und auf der Seite ein Loch; eine durchscheinende Tönung hätte auf Grau zu wenig Kontrast.
- **Wertung** (`ScoringToggle`): „1“ für ganze Ringe, ⅒ für Zehntel, gesetzt von Geist selbst (`diagonal-fractions`, das
  Merkmal `frac`), nie mit `sup`/`sub` (die verschiebt Tailwind schon); die tiefgestellten Zeichen ₀–₉ fehlen in den
  geladenen Teilen von Geist. Ein Tippen stellt auf die andere. Ob die gezeigte die amtliche ist, sagen Name und Tooltip;
  ist die amtliche die andere, nennt der Name sie in der Wirkung („auf ganze Ringe (amtlich) umstellen“).
- **Art** (`KindToggle`): Pokal, Training durchgestrichen (der Strich schneidet über eine Maske eine Lücke, wie die
  „-off“-Symbole von lucide; `lucide-react` hat keinen solchen Pokal), Wettkampf gold auf goldener Tönung.
- **Leise:** Zeichen im Token `quiet` (mindestens 3,2 : 1 auf der Tönung, auf Seite und Karte, hell und dunkel; nie für
  Text), Linie 1,75; „1“ und ⅒ in `muted-foreground`, mittelstark. Die „1“ in 13 px statt 16 px, damit sie so ruhig
  wirkt wie die kleinen Ziffern des Bruchs.
- **Ort:**
  - Seite einer Scheibe: Pokal und Bruch rechts in der Zeile des Ergebnisses (Platz `actions` von `CardResult`; nur
    Probe: nur der Bruch), am Telefon im Kopf, ab 768 px in der Box.
  - Liste und Fortschritt: kein Kreis, sondern ein Wechsel-Chip direkt nach dem Chip „Filter“ (`ScoringChip` in
    `ListControls`, `PeriodControls`): in Worten mit Bezug und ⇄, neutral umrandet (der blaue Chip öffnet ein Blatt), ein
    Tippen stellt um. In der Liste „Ø in ganzen Ringen“ / „Ø in Zehnteln“ (er ändert Ø und Abstand, nicht die Spalten
    der Ergebnisse), im Fortschritt „In ganzen Ringen“ / „In Zehnteln“ (die ganze Seite). Am Telefon steht er neben dem
    Chip „Filter“ in der zweiten Zeile; ein Segment-Schalter bräche dort in eine dritte Zeile um.
  - Start: neben dem Ø je Block (der Block ist eine Karte, keine Filter); dort entfällt „in ganzen Ringen“ im Text.
  - Regel: in einer Filterzeile ein Chip in Worten, direkt neben einer Zahl der Kreis.
- **Liste:** der Pokal in der Spalte „Art“ 16 px in Gold, damit er auffällt.
- **Eine Wahl je Seite:** Kopf am Telefon und Box zeigen denselben Zustand; ein Fehler steht im Platz `notice`, auf
  Start gleich unter der Zahl, in Liste und Fortschritt unter den Filtern.

## Was noch fehlt

Stand am Code (15. Oktober 2026):

- **Auswahl** (SP-1.8; der Vergleich braucht C2 aus SP-2.2): nicht gebaut.
  - Aktionen: Vergleichen (genau zwei), Im Verlauf zeigen, Aus Verläufen ausnehmen (die sanfte Alternative ohne
    Löschen; das Merkmal `ausgenommen` kennt der Fachkern, setzen lässt es sich nicht), Nicht meine, Löschen mit
    Bestätigung und „Gelöscht · Rückgängig“; dazu die Art mehrerer Scheiben auf einmal.
  - Auf dem Telefon über langes Drücken oder „Auswählen“, am Desktop über Kästchen. Im Auswahlmodus ersetzt eine
    Aktionsleiste die untere Navigation.
  - Heute löscht man nur an der Seite einer Scheibe.
- **Scannen** (QR-Weg, SP-1.7 b): `/scan` ist ein Platzhalter und nicht in der Navigation. Geplant: Vorschau,
  Bestätigen, dann die Seite der neuen Scheibe; „←“ führt in die Liste, die neue Scheibe ist dort über `pick` markiert
  (die Markierung steht schon). Dann steht Scannen wieder in der Navigation: erhaben in der Mitte der unteren Leiste, am
  Desktop „QR scannen“ und „Link einfügen“.
- **Weitere Fälle in „Offen“:** wartender QR-Scan (SP-1.7 b), „Das war ich“ ([[spiegel-assignment]]), eine Vorschau des
  Nachladens (SP-2.5). Das Nachladen selbst läuft ohne Vorschau; Profil zeigt seinen Stand.
- **Weiche Sperre aufheben:** Kein Weg hebt eine `DeleteLock` auf; auch das Nachladen schickt der Brücke alle Sperren
  mit. Das Holen per QR (SP-1.7 b) und „Scheibe holen“ (SP-2.4) fehlen noch.
- **Vergleich zweier Scheiben** (`/compare`, C2, SP-2.2): nur im Routen-Modell.
- **„Läuft gerade“ auf Start** („Läuft · Stand 6 · 23 Schuss“): nicht gebaut.
- **Abstand zum Schnitt in den Kacheln einer Scheibe:** Die Kacheln des Überblicks zeigen ihn nicht; käme er, wäre es
  der Schnitt der fünf davor.
- **„Kleine“ Scheiben (SF-11):** Einklappen entfällt. Ob Nebenscheiben (Einschießen, Neustart, Abbruch) im Verein
  vorkommen und ob sie im Fortschritt zählen, klären echte Daten.
- **Abend-Seite:** erst mit der Verknüpfung mit Treffsicher (SP-3.1).

## Skizze

```
Telefon (eine Spalte, untere Leiste immer da; Scannen kommt mit SP-1.7 b)

┌── Start ──────────────────────────┐    ┌── Scheiben ───────────────────────┐
│ Offen (1)                       › │    │ [LG | LP] [Alle Scheiben]         │
│ ┌ Luftgewehr · Di 30.9. ─────┐    │    │ [Ø in Zehnteln ⇄]                 │
│ │ Im Formband: 0,09 über …   │    │    │ ┌ September 2026 ────────────┐    │
│ │ Ø je Schuss groß     (⅒)   │    │    │ │ Di 30.9. (◎) Ergebnis …    │    │
│ │ Schnitt der 5 davor: …     │    │ ─▶ │ │          (◎) Ergebnis …    │    │
│ │ Formband, 20 Scheiben      │    │    │ │    auch 1 Scheibe LP ›     │    │
│ │ [Kachel] [Kachel]          │    │    │ │ Do 25.9. (◎) Ergebnis …    │    │
│ │ Abend in Scheiben ›        │    │    │ └────────────────────────────┘    │
│ └────────────────────────────┘    │    │                                   │
│ Form der letzten 90 Tage        › │    │                                   │
├───────────────────────────────────┤    ├───────────────────────────────────┤
│ Start Scheiben Fortschritt Profil │    │ Start Scheiben Fortschritt Profil │
└───────────────────────────────────┘    └───────────────────────────────────┘
        │ Kachel                                 │ Zeile
        ▼                                        ▼
┌── Scheibe (CardPage) ─────────────┐   ┌── Fortschritt (PeriodPage) ─────────┐
│ ← Scheiben    ‹ vorige nächste ›  │   │ Letzte 90 Tage · [LG | LP] [Filter] │
│ Kopf, Ergebnis, Beobachtungen     │◀──│ Liste → „Scheibe öffnen“            │
│ Scheibe · Schüsse · Analyse       │──▶│ „Alle in Scheiben zeigen“ → Liste   │
└───────────────────────────────────┘   └─────────────────────────────────────┘

Desktop (Seitenleiste ab 1024 px, Seiten in voller Breite)

┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Spiegel      │ Scheiben  [LG | LP] [Alle Scheiben] [Ø in Zehnteln ⇄]        │
│ ▸ Start (1)  │ ┌ September 2026 ────────────────────────────────────────┐   │
│ ▸ Scheiben   │ │ Di 30.9. (◎) Zeit Art Ringe Zehntel Ø Schnitt Schuss   │   │
│ ▸ Fortschritt│ │         auch 1 Scheibe Luftpistole ›                   │   │
│ ▸ Profil     │ │ Do 25.9. (◎) …                                         │   │
│ ▸ Admin      │ └────────────────────────────────────────────────────────┘   │
│              │                                                              │
│ Darstellung  │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```
