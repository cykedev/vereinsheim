---
id: spiegel-navigation
type: concept
title: "Spiegel — Navigation, Einstieg und Auswahl"
aliases: [navigation-spiegel, einstieg, scheiben-liste-konzept, app-rahmen]
keywords: [art der scheibe, wettkampf, training, kindchoice, navigation, einstieg, startseite, start, scheiben-liste, übersicht, auswahl, auswahlmodus, abend, trainingsabend, einheit, mischabend, familie, blättern, vorige, nächste, zurück, adresse, url, query, deep link, routen, seitenleiste, untere leiste, bottom navigation, scan, scheibe holen, holen, qr, ausdruck an der scheibe, von der anlage, nicht mehr holen, offen, bestätigen, eingang, löschen, papierkorb, rückgängig, weiche sperre, löschsperre, grabstein, wiederherstellen, admin, profil, fortschritt, schnitt davor, wertung, zehntel, ganze ringe, wertung der scheibe, wertung der familie, wie am stand, amtliche wertung, liste aus meyton, rangliste, filter liste, zeitraum merken, gemerkter zeitraum, kalender blättern, früher, später, darstellung, cookie, teilen, link teilen, geteilte scheibe, share, uuid, ohne anmeldung, herkunft, gemessen, vom ausdruck, eingetragen, detailtiefe, serien-summen, gesamtergebnis, ohne werte, wartet auf die anlage, grund, ort, belege, beleg, ergebnisliste, foto anhängen, originalname]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-langzeit]]", "[[spiegel-assignment]]", "[[spiegel-mobile]]", "[[spiegel-roadmap]]", "[[spiegel-privacy]]", "[[spiegel-edge-cases]]", "[[spiegel-durchsicht]]", "[[navigation-pattern]]"]
---

**TL;DR** Spiegel öffnet auf **Start**: „Offen (n)“, je Familie der letzte Abend groß (Satz, Formband, Kacheln, neue
Rekorde) und die Form der letzten 90 Tage. Daneben stehen die Bereiche **Scheiben** (Liste nach Abend, eine Familie),
**Fortschritt** (Seite eines Zeitraums) und **Profil**; **Scheibe holen** (`/scan`) ist die Aktion in der Mitte. Liste und
Fortschritt sind zwei verlinkte Bereiche mit derselben Filterzeile und derselben Familie. Wertung und Art gehören zur
Scheibe bzw. Familie und werden beim Umschalten gespeichert. Gelöschtes liegt 30 Tage im Papierkorb, danach hält eine
weiche Sperre die Brücke ab, die ausdrückliches Holen wieder aufhebt. Der ganze Zustand steht in der Adresse, mit
englischen Pfaden. Offen ist vor allem die Auswahl.

## Konzept

Spiegel folgt dem Aufbau „Start und Bereiche“ aus [[spiegel-ui-design]]: ein eigener Einstieg, daneben Bereiche wie
Reiter einer App; das Rückgrat ist die Liste der Scheiben. Die Seiten einer Scheibe (`CardPage`) und eines Zeitraums
(`PeriodPage`) hängen über Adressen und Links zusammen.

- **Die Liste gliedert sich nach Abend.** Im Modell heißt das „Einheit“ (Konto + Tag, [[spiegel-data-model]]), in der
  Oberfläche „Abend“. Ein Abend hat keine eigene Seite; eine Zeile öffnet die Scheibe. Eine Abend-Seite kommt erst, wenn
  das Tagebuch sie braucht ([[adr-033]], Stufe 2).
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
| Scheiben | untere Leiste | Seitenleiste | `/cards?family=lp-auflage&kind=training&provenance=entered#2026-09-25` |
| Fortschritt | untere Leiste | Seitenleiste | `/progress?range=12m&compare=previous&family=lg-freihand&warmup=1&pick=<id>#history` |
| Profil | untere Leiste, für Admins oben die Bereiche des Admins | Seitenleiste | `/profile` |
| Admin | in Profil oben (Abschnitt „Admin“ mit allen Bereichen), nur für Admins | letzter Eintrag der Seitenleiste, nur für Admins | `/admin{/users,/disciplines,/lists,/site}` |
| Scheibe holen | Mitte der unteren Leiste, nur das Symbol (`ScanQrCode`), der Name für Screenreader | Pille „Scheibe holen“ in der Seitenleiste | `/scan` |
| Tagebuch | nur mit Tagebuch: untere Leiste statt Scheiben (die stehen dann in Profil als „Alle Scheiben“) | nur mit Tagebuch: Seitenleiste nach Scheiben (`BookOpen`) | `/diary`, Faden `/diary/thread`, Neuer Eintrag `/diary/new`, Eintrag `/diary/<id>` ([[spiegel-diary]]) |

Seiten ohne eigenen Bereich:

| Seite | Adresse |
|---|---|
| Scheibe | `/cards/<id>?from=progress&family=lg-freihand&series=2&shot=23#position` |
| Offen | `/open` |
| Papierkorb | `/profile/trash` |
| Geteilte Scheibe | `/share/<uuid>`: ohne Anmeldung und ohne Rahmen der App (siehe „Teilen per Link“) |
| Vergleichen | `/compare?type=cards&a=<id>&b=<id>` · `/compare?family=lp-freihand&a=6m` (zwei Zeiträume, B der davor) · `/compare?type=kind&family=lp-freihand&range=all`; Unterseite von Fortschritt: Umschalter „Zeitraum · Vergleichen“ oben auf beiden Seiten, am Desktop eingerückt unter Fortschritt, in der unteren Leiste markiert Fortschritt ([[spiegel-vergleichen]]) |

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
  - `compare`: `previous` oder eine Id. Spiegel leitet eine solche Adresse auf die Seite Vergleichen um
    (`compareFromProgress`); Treffsicher nutzt den Vergleich im Blatt „Filter“ weiter.
  - Vergleichen: `type` (`cards`, `kind`; ohne: zwei Zeiträume, mit B immer `type=periods`), bei zwei Scheiben `family` (ohne Ids die
    beiden neuesten dieser Familie; mit Scheibe A gilt deren Familie), `a` und `b` (Ids zweier
    Scheiben oder Zeiträume wie `range`, B auch `previous` als Vorgabe), `range` bei Wettkampf und Training (Vorgabe
    `12m`), dazu `family`, `kind`, `warmup=1`. Eine alte Adresse mit `a` und `b` ohne `type` sind zwei Scheiben.
  - Filter: `family`, `kind` (`training`, `competition`), `flag`; in der Liste dazu `list` (Kennung der Liste aus
    Meyton, nie ihr Name).
  - Darstellung im Fortschritt: `warmup=1` (Einschießen mitzählen; eine alte Adresse mit `sighters` gilt als
    Vorgabe), `metric` (`sigma`, `tens`,
    `tempo`), `view` (`cards`, `months`), `show=target` (das Trefferbild statt des Verlaufs als Hauptbild; die Sicht
    Form oder Lage steht nicht in der Adresse). `scoring=rings` kennt das Modell; die App rechnet den Fortschritt in der
    Wertung der Familie und übergeht es.
  - Wahl: `pick` mit der Id einer Scheibe (im Fortschritt die gewählte, in der Liste die markierte).
  - Scheibe: `from` (`list`, `start`, `progress`) mit den Schlüsseln der Herkunft, ohne `pick` und ohne deren Wertung;
    dann `series` (Serie bis 999; die ganze Scheibe ist die Vorgabe und fehlt), `shot` (Nummer wie auf der Scheibe,
    `23`), `scoring`.
  - Anker englisch, die Beschriftungen auf der Seite deutsch: Scheibe `#target`, `#shots`, `#analysis`, Reiter
    `#overview`, `#result`, `#precision`, `#position`, `#time`; Fortschritt `#history`, `#cards`, `#numbers`,
    `#analysis`, dazu die Reiter seiner Analyse `#result`, `#precision`, `#position`; die Liste trägt den Abend (`#2026-09-25`).
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
  - Unter 1024 px eine untere Leiste mit fünf Feldern, „Scheibe holen“ erhaben in der Mitte (nur das Symbol, wie
    „Neue Einheit“ in Treffsicher; `short: "Holen"`); die Seitenleiste zeigt „Scheibe holen“ als Pille.
  - Telefon quer (unter 500 px hoch): eine schmale Leiste links. Eine untere Leiste nähme dort 72 von 375 px, die
    Scheibe passte nicht mehr unter die Sprungleiste.
  - **Mit Tagebuch** ([[spiegel-diary]]) ist die untere Leiste Start, Tagebuch, Scheibe holen, Fortschritt, Profil;
    die Liste der Scheiben öffnet am Telefon „Alle Scheiben“ in Profil, und ist sie offen, ist Profil markiert
    (`barAreaOf`). Die Seitenleiste nennt Tagebuch nach Scheiben. Ohne Tagebuch bleibt alles wie oben.
  - Admin sieht nur ein Admin; auf dem Telefon steckt Admin in Profil, und ist Admin offen, ist dort Profil markiert.
    Profil nennt dafür ganz oben alle Bereiche des Admins (Übersicht, Konten, Disziplinen, Listen, Anlage und Brücke,
    `ADMIN_SECTIONS`), so ist jeder zwei Tipps entfernt. Jede Admin-Seite trägt dieselben Reiter (`AdminTabs`, eine Zeile, die wischt), auch
    Konto, Disziplin und Liste; dort ist der Reiter ihres Bereichs markiert und führt zurück. Listen und Disziplinen
    sind gleich gebaut: Liste in Abschnitten, jede Zeile führt auf ihr Blatt, dort Einstellen mit den Folgen.
  - Platz der Leiste: `--app-bar` (72 px), gesetzt in `design2.css` an `:root`, solange der Rahmen da ist. Die Pille
    „Zurück zu …“ (`ReturnPill`), der Abstand der Seite, die Größe der Scheibe und die Toasts richten sich danach.
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
    18 ganze Ringe“); die Kacheln einer Reihe teilen zwei Zeilen (`grid-rows-subgrid`), Uhrzeit und Art oben, das
    Ergebnis darunter, damit die Ergebnisse auf einer Linie stehen, auch wenn „Training nur Probe“ umbricht;
  - neue Rekorde, nur wenn der Abend welche aufgestellt hat, höchstens fünf in der Reihenfolge des Katalogs, darunter
    „Noch N weitere Rekorde im Fortschritt ›“ (Fortschritt, Abschnitt Analyse, dort „Alle Rekorde“ aufgeklappt);
  - „Abend in Scheiben ›“.
- **Form:** „Form der letzten 90 Tage“ für die zuletzt gewählte Familie als Titel und ein Satz („Luftgewehr: Ø 10,25 je
  Schuss, deutlich besser als in den 90 Tagen davor (+0,15).“), mit Link in den Fortschritt (`FormLine`).
- **Der Verlauf zeigt Scheiben**, nicht Abende. Schnitte über mehrere Scheiben rechnen über ihre Schüsse ([[adr-034]]).
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
  Scheiben und Schüsse) und einer Tabelle (Datum, kleine Scheibe 48 px, Uhrzeit, Art, Ergebnis, Ø je Schuss, zum Schnitt,
  Schuss). Ein Abend ist eine Gruppe von Zeilen mit dem ISO-Tag als Anker: Das Datum steht einmal, ohne eigenen Kopf und
  ohne Zahl je Abend. Alle Scheiben eines Abends stehen gleichberechtigt da, nichts ist eingeklappt.
- **Mischabend:** Wurde am Abend auch eine andere Familie geschossen, steht darunter eine kleine, rechtsbündige Zeile
  („auch 1 Scheibe Luftpistole ›“). Antippen wechselt die Familie und springt zum selben Abend. So bleibt die Liste rein,
  und kein Abend wirkt unbemerkt unvollständig. Der Hinweis zählt ohne Art, Merkmal und Liste, nur im Zeitraum; der
  Sprung (`listOnEvening`) lässt sie deshalb fallen, so steht der versprochene Abend sicher in der Liste.
- **Ergebnis in beiden Wertungen:** Spalten „Ganze“ (für Screenreader „Ganze Ringe“) und „Zehntel“, die Wertung der Scheibe fett (siehe „Wertung
  je Scheibe und je Familie“) und im Namen des Links. Meyton liefert die Anzeigeart je Treffer (`Treffer.Wertung` seit
  ShootMaster 5.2, [[meyton-ssmdb2]]). Ø und Abstand stehen für die ganze Liste in der Wertung der Familie, damit die
  Spalte vergleichbar bleibt.
- **Filter** (`ListControls`): eine Zeile mit Familie und Chip, danach der Wechsel-Chip der Wertung. Das Blatt „Filter“
  wirkt bei jeder Wahl sofort und bleibt offen, man sieht die Liste dahinter wechseln. Darin Art, Liste aus Meyton,
  Merkmal, der Zeitraum (mit „entfernen“) und „Im Fortschritt zeigen“.
  - Ein gewähltes Merkmal bleibt wählbar, auch wenn die Familie es nicht hat; sonst ließe es sich nicht lösen.
  - **Herkunft** (`provenance=measured|printout|entered`, Knöpfe „Gemessen“, „Vom Ausdruck“, „Eingetragen“, mit „?“ zu
    „Grundlage und Herkunft“): steht im Blatt, sobald die Familie mehr als eine Herkunft hat oder eine gewählt ist; am
    Chip mit Namen. Ersetzt das Merkmal „Nur PDF“, das kein Code setzte. Der Sprung an einen Abend einer anderen Familie
    lässt sie fallen.
  - **Liste aus Meyton:** `ListQuery.list` als Kennung (`list=<id>`), am Chip „Liste RWK_LP“. Eine gewählte Liste bleibt
    wählbar, auch ohne Scheibe der Familie; eine unbekannte Kennung gilt als keine. Der Sprung an einen Abend einer
    anderen Familie und „Alle in Scheiben zeigen“ lassen sie fallen, das Blättern in einer Scheibe behält sie
    (Herkunft).
- **Listen statt Ranglisten:** Die `Rangliste` aus Meyton heißt in jeder sichtbaren Zeile „Liste“ (Admin, Dialog,
  Erklärung, Seite einer Scheibe, Filter); `OLD_WORDS` hält „Rangliste“ fern. Scheiben aus dem PDF oder aus `seed:own`
  haben keine.
- **Familie in der App:** ohne Angabe die der neuesten Scheibe; die Navigation hängt die zuletzt gewählte an.
- **Herkunft und Gründe in der Zeile:** Unter der Art steht leise „eingetragen“ oder „vom Ausdruck“, nie „gemessen“.
  Jede „–“ trägt ihren Grund als Tooltip und für Screenreader („wartet auf die Anlage“, „ohne Zehntel“, „keine Scheibe
  davor“, bei einer Scheibe der Brücke ohne Schuss „noch kein Schuss“ wie auf ihrer Seite); der Name des Links sagt „ohne Ergebnis (wartet auf die Anlage)“. Gründe und Herkunft stehen im Modell nur,
  wenn sie etwas sagen.
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
- **Metazeile** unter dem Titel mit der Liste aus Meyton, der Herkunft und dem Ort („Wettkampf · Liste RWK_LP · gemessen ·
  Sa 26.09.2026 · 10:30“, „Training · eingetragen · Vereinsheim Nord · …“, `cardMeta`). Die geteilte Seite nennt die
  Herkunft, nie den Ort.
- **Ein Gerüst für jede Detailtiefe** (`detailLevel` wählt nur den Inhalt): dieselben Abschnitte, Leiste, Ergebnis-Box
  und Reiter wie mit Schüssen. Nur Serien-Summen: große Zahl, Schusszahl und Ø je Schuss, Grund („nur Serien-Summen“,
  „ohne Zehntel“), die Serien unter der Scheibe in derselben Leiste mit dem leisen Platzhalter, in Schüssen „Keine
  Einzelschüsse.“ und in der Analyse, was fehlt. Nur Gesamtergebnis: große Zahl mit Grund, eine Trefferlage als Summe als Zeichen des Schwerpunkts
  („nur die Mitte der Schüsse, keine Streuung“), an der Stelle der Serien „Keine Serien.“. Ohne
  Werte: „–“ mit „wartet auf die Anlage“ (vom Ausdruck), „ohne Werte“ (eingetragen) oder „noch kein Schuss“ (Brücke),
  sonst nur „Noch keine Serien.“, „Noch keine Schüsse.“, „Noch keine Werte.“ (ohne „noch“, wenn keine Werte mehr kommen).
  Der Grund steht einmal, in der Ergebnis-Box. Ohne bekannte Uhrzeit (getippte ID ohne Ausdruck, `timeKnown`) nennen Kopf,
  Liste, Start und Vergleichen nur den Tag; die Liste zeigt „–“ mit „ohne Uhrzeit“. Probe neben Summen der Wertung
  zählt nicht: Die Seite zeigt die Summen, die Art bleibt Training mit Kreis.
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
- **Kasten „Diese Scheibe“** am Ende (`CardActions`, nur für den Besitzer): Eintrag (eingetragene Scheiben), Ausdruck,
  Von der Anlage, Ort (vom Ausdruck), Belege (jede Scheibe, direkt vor „Disziplin“), Disziplin, Teilen und Löschen als
  Zeilen, je
  mit Zustand links und Aktion rechts („Ändern“, „Teilen“, „Löschen“; für Screenreader „Disziplin ändern“,
  „Scheibe teilen“, „Scheibe löschen“). Darüber „Mit der Scheibe davor vergleichen“ als eigener Kasten. Nach
  conventions §2 stünden sie oben (`DetailActionBar`); der Kopf ist aber schon voll, und man braucht sie selten. Siehe
  „Ausdruck und Holen an der Scheibe“, „Disziplin einer Scheibe“, „Teilen per Link“ und „Löschen und Papierkorb“.

## Ausdruck und Holen an der Scheibe

Gleiches steht an derselben Stelle: ID, PDF und der Auftrag an die Anlage sind Zeilen im Kasten „Diese Scheibe“, vor
Disziplin, wie dort mit Zustand links und Aktion rechts. Die geteilte Seite (`/share`) zeigt sie nicht, denn ID und
Abend holen die Scheibe.

- **Ausdruck** (`CardPrintout`, wenn es eine ID oder einen Ausdruck gibt): „ID ff914420 · gedruckt Di 27.10.2026 um
  19:52“ mit „PDF öffnen“ (`/api/printouts/<id>`, nur für den Besitzer, nicht aus dem Papierkorb); weitere Ausdrucke
  darunter. Ohne PDF nur die ID und „Das PDF hängt an, wenn du den QR-Code unter „Scheibe holen“ scannst.“ Die ID kommt
  von der Brücke (`scheibenId`), sonst vom jüngsten Ausdruck, sonst vom Auftrag (`cardFetchInfo`).
- **Von der Anlage** (`CardFetch`, solange der Auftrag etwas zu sagen hat, `requestShown`): Zustand und Satz
  (`REQUEST_STATUS_TEXT`, `REQUEST_STATUS_NOTE`). Wartend „Nicht mehr holen“, beendet ohne Werte „Entfernen“, beides mit
  Rückfrage (`cardFetchStop`, `cardFetchDismiss`); der Auftrag ist danach zurückgezogen, Scheibe und PDF bleiben.
- **Grund ohne Werte** folgt dem Auftrag: Eine Scheibe vom Ausdruck ohne offenen, ungefüllten Auftrag heißt „ohne
  Werte“ statt „wartet auf die Anlage“ (`waiting: false`, in Liste, Start, Fortschritt, Vergleichen und auf der Seite).

## Von Hand eintragen

Eine Scheibe ohne Ausdruck (fremde Anlage, Papier, Gedächtnis) entsteht auf demselben Weg wie die anderen ([[adr-033]],
Teil 1d, entschieden mit dem User am 28. Oktober 2026):

- **Einstieg:** fünfte Karte „Von Hand eintragen“ auf „Scheibe holen“. „Eintragen“ öffnet das Blatt „Neue Scheibe“
  (Disziplin und Art, ohne ID-Zeile, Knopf „Weiter“), danach das Formular `/cards/new?discipline=…&kind=…`. Angelegt
  wird erst beim Speichern; eine Disziplin, die nicht zur Wahl steht, führt zurück zu „Scheibe holen“.
- **Formular** (`EnteredCardForm`, Logik rein in `src/lib/entered/form.ts`): Tag, Uhrzeit (wenn bekannt; ohne gilt 12 Uhr
  und `Card.timeUnknown`, gezeigt wird nur der Tag), Ort als Freitext mit den eigenen Orten als Vorschlag, Werte in
  Zehnteln oder ganzen Ringen (nie umgerechnet, „97“ in Zehnteln ist 97,0), dann Serien mit „Schüsse einzeln“ zum
  Aufklappen (die Summe kommt dann aus den Schüssen) oder nur das Gesamtergebnis mit Schusszahl (leer: die der
  Disziplin). Eine Disziplin ohne Serienlänge hat nur das Gesamtergebnis. Leere Serien am Ende zählen nicht, eine Lücke
  ist ein Fehler. Schüsse einzeln in allen gefüllten Serien oder in keiner, wie das Modell aus 1a-1 es verlangt (in der
  Prod-Kopie von Treffsicher hat keine Einheit Schüsse nur in einigen Serien). Trefferlage als Summe waagrecht und
  senkrecht in mm mit Richtung. Fehler stehen am Feld, ein Wert, der nicht passt, schon
  beim Verlassen des Felds. „Zurück“ mit Eingaben fragt (`enteredDiscard`).
- **Schnell zu tippen** (Wunsch des Users vom 28. Oktober 2026: richtig gut aussehen, extrem gut bedienbar): Das Formular
  nimmt die volle Breite einer Spalte (`PAGE_SINGLE`, wie „Scheibe holen“), Tag, Uhrzeit und Ort in einer Reihe. Je Serie
  eine Zeile mit Name, Summe und „Schüsse einzeln“; aufgeklappt zehn Felder, am Telefon in zwei Reihen, sonst in einer,
  auf einer leicht abgesetzten Fläche, Name und Summe bleiben auf derselben Linie wie in den übrigen Serien. Ein fertiger Schuss springt ins
  nächste Feld (`shotComplete`: in Zehnteln nach der Stelle hinter dem Komma, in ganzen Ringen nach einer Ziffer außer
  der 1 oder nach 10), Enter ebenso; nach dem letzten Schuss einer Serie klappt die nächste leere auf. Gesamt und
  „Speichern“ kleben über der unteren Leiste.
- **Ändern:** Zeile „Eintrag“ im Kasten „Diese Scheibe“ („Von Hand eingetragen“, „Aus Treffsicher übernommen“) mit
  „Ändern“ zu `/cards/<id>/edit`. Geänderte Werte sind eine neue Revision (`writeEnteredCard`), Tag, Uhrzeit und Ort
  stehen an der Scheibe ohne Verlauf, wie Disziplin und Art. Kann das Formular die Angaben nicht genau so wieder
  speichern (Lage, Zeit oder Probe an Schüssen, Summen mit Ringen und Zehnteln, Serien einer anderen Serienlänge als
  heute, eine Mitte mit eigener Schusszahl), fehlt „Ändern“, und die Action lehnt ab (`detailsToForm` prüft den Weg
  hin und zurück). Wechselt die Disziplin im Formular, bleibt alles Getippte (`fitToDiscipline`); zugeklappt gilt die
  Summe aus den Schüssen (`toggleRow`). Bleiben Tag und Uhrzeit, bleibt der gespeicherte Beginn auf die Millisekunde. Löschen wie jede Scheibe.
- **Ort einer Scheibe vom Ausdruck:** Zeile „Ort“ mit einem Blatt (`setCardPlace`). Scheiben der Anlage tragen ihren Ort
  über die Anlage und haben keine Zeile.
- **Belege** (Zeile „Belege“ an jeder eigenen Scheibe, gleich welcher Herkunft, [[adr-033]] Nachtrag 1f): bis zu
  10 Fotos oder PDFs, etwa eine Ergebnisliste, nur zum Nachsehen, in keiner Zahl und ohne Revision. Leer „Fotos oder PDFs
  zu dieser Scheibe, etwa eine Ergebnisliste.“, sonst die Zahl, bei 10 der Satz zur Grenze ohne Knopf. Je Datei eine
  Zeile: Vorschaubild aus der Datei selbst (`loading="lazy"`, ein PDF als Fläche „PDF“), Name der Datei wie vom Browser,
  darunter Art, Größe und Tag; ein Tipp öffnet die Datei in einem neuen Tab (`/api/evidence/<id>`, Sandbox, Speichern
  trägt den Namen), × entfernt sie nach der Rückfrage (`evidenceRemove`, nennt Namen und die Belege, die bleiben).
  „Foto oder PDF anhängen“ nimmt mehrere Dateien in einem Zug, je Datei eine Anfrage, nacheinander. Der Browser zeichnet
  Fotos neu als JPEG unter 4 MiB (Grenze der Anfrage 5 MiB, `prepareEvidence`), das nimmt die Drehung mit und lässt die
  übrigen Metadaten weg; der Name behält den Stamm mit `.jpg`. Der Typ zählt an den Bytes. Was nicht angehängt ist, steht
  mit Grund unter der Liste (zu groß, nicht lesbar, Meyton-Ausdruck mit dem Weg über „Scheibe holen“, schon an dieser
  Scheibe, über der Grenze in einem Satz), bis zur nächsten Aktion; ging alles, kein Bericht. Dieselbe Datei hängt an
  einer Scheibe nur einmal, an zwei Scheiben liegt sie einmal auf der Platte. Kein „Ersetzen“, nie auf der geteilten
  Seite.

## Fortschritt

`/progress` zeigt die Seite eines Zeitraums ([[spiegel-langzeit]]) mit den eigenen Scheiben.

- **Rechnen:** Der Server liest die Abfrage aus der Adresse und rechnet `periodModel` aus den Projektionen
  (`progressPageData` in `src/lib/overview.ts`), in der Wertung der Familie. An den Browser geht das leichte Modell
  (`lightPeriodModel`: Scheiben ohne Werte und Rekorde ihrer Projektion, die Kennzahl ohne Rechnung).
- **Filter schreiben die Adresse:** Zeitraum, Vergleich, Familie, Art, Einschießen, Kennzahl und Darstellung; die Seite
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

- **Löschen:** mit Bestätigung (Dialog mit Folgen), als Zeile im Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe
  (`DeleteCard`): „Danach liegt die Scheibe 30 Tage im Papierkorb im Profil.“ und „Löschen“. Danach geht es den Rückweg
  zurück, dort steht „Scheibe gelöscht · Rückgängig“ (`useUndo`).
- **Papierkorb:** 30 Tage, unter Profil (`/profile/trash`), mit „Wiederherstellen“ und „Endgültig löschen“.
  Wiederherstellen geht ohne Brücke. In dieser Zeit zählt die Scheibe nirgends mit, auch nicht in Rekorden und
  Verläufen. Eine alte Adresse einer gelöschten Scheibe führt in den Papierkorb (`ownCardState`).
- **Danach endgültig:** `purgeExpiredTrash` löscht beim Start des Servers und stündlich Rohdaten, Ableitungen und PDF.
- **Weiche Sperre statt Grabstein** (`DeleteLock`):
  - Spiegel merkt sich nur den Schlüssel (Quelle, Epoche, ScheibenID), keine Schussdaten, und verteilt ihn an die
    Brücke.
  - Grund: Die Brücke hat keinen eigenen Zustand, gleicht die letzten 30 Tage ab und schickt nach einer Korrektur einen
    neuen Snapshot. Ohne Sperre käme eine Opt-in-Scheibe am nächsten Abend von selbst zurück.
  - Ausdrückliches Holen auf „Scheibe holen“ hebt die eigene Sperre dieses Abends auf und legt die Scheibe vom
    Ausdruck wieder an; die Brücke füllt sie, solange Meyton sie noch hat. Eine eigene Scheibe im Papierkorb holt es
    zurück. Grabsteine und Sperren anderer Konten bleiben. Das Nachladen hebt keine Sperre auf.
- **Grabstein** für „Nicht meine“ und abgelehnte Scheiben, denn dort geht es um die Daten eines anderen (SF-28, SF-37).
  Meldungen „nicht meine“ einer Nummer hebt ein Admin am Konto auf (`liftNotMine`); die Scheiben kommen wartend wieder.
- Der Papierkorb zeigt auch, was nicht von selbst wiederkommt: eigene endgültig gelöschte Scheiben und eigene Meldungen
  „nicht meine“.

## Disziplin einer Scheibe

War am Stand die falsche Disziplin gewählt (etwa Auflage auf einer LP-Scheibe), stellt der Schütze sie an der Scheibe um
(User, 24. Oktober 2026; SF-16 für dieselbe Scheibe):

- **Wo:** als Zeile im Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe (`CardDiscipline`): „Disziplin“ und „LP
  40“, nach einer eigenen Wahl leise „Am Stand gewählt: …“. „Ändern“ öffnet ein Blatt mit den Disziplinen derselben
  Scheibe nach Familie (Knöpfe, mit der Tastatur durchgehbar); die Wahl fragt mit Folgen (`cardDiscipline`), „Ändern“ in
  der Rückfrage stellt um, die Disziplin vom Stand „Zurückstellen“. Ohne andere Möglichkeit steht nur der Name da. Nicht
  auf der geteilten Seite, die auch nicht verrät, dass gewählt wurde.
- **Was wählbar ist:** eingeordnete Disziplinen der Anlage mit Familie und demselben Scheibenbild wie die vom Stand,
  nicht ignoriert (`choiceWhere`), und die vom Stand, solange der Admin sie nicht ignoriert (sonst verschwände die
  Scheibe). Die Werte bleiben, wie Meyton sie gemessen hat; ohne Scheibenbild am Stand nur zurück.
- **Was passiert:** Die Familie zieht mit (Liste, Fortschritt, Rekorde, Start), Schusszahl und Merkmale rechnet Spiegel
  mit der gewählten neu. Ohne eigene Wertung folgt die Wertung der neuen Disziplin; die Rückfrage sagt das. Gewählte
  Wertung und Art bleiben. Spätere Stände aus Meyton mit derselben Disziplin lassen die Wahl stehen; bringt Meyton eine
  andere, gilt wieder die vom Stand. Ein neuer Block derselben ScheibenID erbt die Wahl nicht.
- **Offen:** eine Disziplin mit anderem Scheibenbild (LG-Schütze auf LP-Disziplin), dafür wertet Spiegel aus x/y neu
  und setzt `neu-gewertet` (SF-16, [[spiegel-target-library]] „Neu werten“).

## Teilen per Link

Eine eigene Scheibe lässt sich per Link zeigen, ohne dass die andere Seite ein Konto braucht ([[spiegel-privacy]]):

- **Teilen:** als Zeile im Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe (`ShareCard`), anfangs mit „Nur du
  siehst diese Scheibe.“ „Teilen“ fragt mit Folgen (`cardShare`), dann steht der Link `/share/<uuid>` in der Zeile, mit
  „Geteilt seit {Tag}. Wer den Link hat, sieht die Scheibe.“, „Link kopieren“, „Senden…“ (nur mit dem Teilen-Menü des
  Geräts) und „Teilen beenden“ (`cardShareStop`). Ein Link je Scheibe, ohne Ablauf; die UUID kommt aus `randomUUID()`
  und steht an der Scheibe (`Card.shareId`, `sharedAt`).
- **Die geteilte Seite** (`src/app/share/[shareId]`, frei in `proxy.ts`) ist die Seite einer Scheibe mit `own={null}`:
  ohne Rahmen der App, Rückweg, Blättern, Kreise für Art und Wertung und ohne den Kasten „Diese Scheibe“. Sie öffnet in
  der Wertung der Scheibe; Ebenen, Ausschnitt, Serie, Schuss, Lineal, Reiter, Sprungleiste und Hilfe gehen, ändern aber
  nur die Ansicht. Die Adresse bleibt die des Links, nur der Anker des Reiters wechselt. `noindex`, kein Referrer.
- **Wann der Link nicht geht** (Hinweis aus `not-found.tsx`, 404): Teilen beendet, Scheibe gelöscht (`deleteCard`
  beendet das Teilen; Wiederherstellen bringt den Link nicht zurück), wartend, Disziplin ignoriert, Konto deaktiviert.
  Geprüft beim Lesen in `sharedCard` (`VISIBLE_CARD`, aktives Konto).
- **Neu teilen** gibt eine neue UUID; der alte Link bleibt aus.

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
  Listen), sonst die Quelle. `Status` der SSMDB2 ist an der Vereinsanlage leer ([[meyton-ssmdb2]]); eine
  Liste ohne Zuordnung gilt als Training. Ohne Wahl gilt bei einer Scheibe nur aus Probe die Quelle, die Liste zählt
  dann nicht: Der Probeblock vor einem Wettkampf (SF-03) trägt dessen Art.
- **Was folgt:** Filter „Art“ in Liste und Fortschritt, der Pokal in der Liste, die Metazeile der Scheibe, die Rekorde
  „nur Wettkampf“ und ob der Umschalter die Wertung „amtlich“ nennt. Die Wertung selbst ändert die Art nicht.
  Bei einer Scheibe nur aus Probe sagt die Art auch, ob die Wertung der Disziplin gilt: im Wettkampf ja, im Training
  nicht (dann wie am Stand). Ohne gewählte Wertung wechselt die gezeigte Wertung dort mit der Art (SF-01).
- **Bedienung:** auf der Seite jeder eigenen Scheibe als Pokal im weichen Kreis (siehe unten), auch nur aus Probe,
  automatisch gespeichert wie die Wertung.
- **Nur Probe bleibt ein Merkmal neben der Art:** „Training nur Probe“ und „Wettkampf nur Probe“ in Metazeile, Kachel
  auf Start, Namen der Links und Ablesung im Fortschritt („40 Schuss (Probe als Wettkampf)“); in der Liste Pokal und
  „Probe“ nebeneinander. Rekorde und Verläufe zählen eine Scheibe nur aus Probe wie ein Training, egal welche Art; nur
  Einschießen (Probe vor einer Wertung desselben Abends) zählt erst mit „Einschießen mitzählen“ ([[spiegel-langzeit]]).
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
  - Seite einer Scheibe: Pokal und Bruch rechts in der Zeile des Ergebnisses (Platz `actions` von `CardResult`, auch nur
    aus Probe), am Telefon im Kopf, ab 768 px in der Box.
  - Liste und Fortschritt: kein Kreis, sondern ein Wechsel-Chip direkt nach dem Chip „Filter“ (`ScoringChip` in
    `ListControls`, `PeriodControls`): in Worten mit Bezug und ⇄, neutral umrandet (der blaue Chip öffnet ein Blatt), ein
    Tippen stellt um. In der Liste „Ø in ganzen Ringen“ / „Ø in Zehnteln“ (er ändert Ø und Abstand, nicht die Spalten
    der Ergebnisse), im Fortschritt „In ganzen Ringen“ / „In Zehnteln“ (die ganze Seite). Am Telefon steht er neben dem
    Chip „Filter“ in der zweiten Zeile; ein Segment-Schalter bräche dort in eine dritte Zeile um.
  - Start: neben dem Ø je Block (der Block ist eine Karte, keine Filter); dort entfällt „in ganzen Ringen“ im Text.
  - Regel: in einer Filterzeile ein Chip in Worten, direkt neben einer Zahl der Kreis.
- **Liste:** der Pokal in der Spalte „Art“ 16 px in Gold, damit er auffällt; nur aus Probe dahinter das Wort „Probe“
  (`KindMark`), bei Einschießen statt „Probe“ das Wort „Einschießen“. Dieses Wort und die Herkunft darunter („vom
  Ausdruck“, „eingetragen“) tragen weiche Trennstellen (`narrowWord`): Ohne sie war die Spalte 60 bis 74 statt 25 px
  breit, und die Tabelle lief bei 360 und 390 px in ihrer Karte über (gemessen am 29. Oktober 2026; die Skriptprüfung
  hält „jede Tabelle passt in ihre Karte“ fest). Aus demselben Grund stehen Wochentag und Datum am Telefon in zwei
  Zeilen: Sonst trug das breiteste Datum („Di 31.03.“) die Spalte (69 statt 62 px). Die Zahlen des Einschießens stehen leise, auch die Wertung der
  Scheibe nicht fett, und der Abstand zeigt „–“ mit „Einschießen zählt nicht“ (er rechnet ohne Einschießen). Dasselbe
  Wort in der Liste im Fortschritt und in der Metazeile der Kacheln auf Start.
- **Eine Wahl je Seite:** Kopf am Telefon und Box zeigen denselben Zustand; ein Fehler steht im Platz `notice`, auf
  Start gleich unter der Zahl, in Liste und Fortschritt unter den Filtern.

## Was noch fehlt

Stand am Code (27. Oktober 2026):

- **Auswahl** (SP-1.8; der Vergleich braucht C2 aus SP-2.2): nicht gebaut.
  - Aktionen: Vergleichen (genau zwei), Im Verlauf zeigen, Aus Verläufen ausnehmen (die sanfte Alternative ohne
    Löschen; das Merkmal `ausgenommen` kennt der Fachkern, setzen lässt es sich nicht), Nicht meine, Löschen mit
    Bestätigung und „Gelöscht · Rückgängig“; dazu die Art mehrerer Scheiben auf einmal.
  - Auf dem Telefon über langes Drücken oder „Auswählen“, am Desktop über Kästchen. Im Auswahlmodus ersetzt eine
    Aktionsleiste die untere Navigation.
  - Heute löscht man nur an der Seite einer Scheibe.
- **Weitere Fälle in „Offen“:** „Das war ich“ ([[spiegel-assignment]]), eine Vorschau des Nachladens (SP-2.5). Das
  Nachladen selbst läuft ohne Vorschau; Profil zeigt seinen Stand. Scannen und „Weiche Sperre aufheben“ sind erledigt
  (1b-2, „Scheibe holen“).
- **„Läuft gerade“ auf Start** („Läuft · Stand 6 · 23 Schuss“): nicht gebaut.
- **Abstand zum Schnitt in den Kacheln einer Scheibe:** Die Kacheln des Überblicks zeigen ihn nicht; käme er, wäre es
  der Schnitt der fünf davor.
- **„Kleine“ Scheiben (SF-11):** Einklappen entfällt. Ob Nebenscheiben (Einschießen, Neustart, Abbruch) im Verein
  vorkommen und ob sie im Fortschritt zählen, klären echte Daten.
- **Abend-Seite:** erst mit dem Tagebuch ([[adr-033]], Stufe 2).

## Skizze

```
Telefon (eine Spalte, untere Leiste immer da; Holen (◉) erhaben in der Mitte)

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
│ Start Scheiben (◉) Fortschr. Prof.│    │ Start Scheiben (◉) Fortschr. Prof.│
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
│ (Sch. holen) │ │                                                        │   │
│ ▸ Profil     │ │ Do 25.9. (◎) …                                         │   │
│ ▸ Admin      │ └────────────────────────────────────────────────────────┘   │
│              │                                                              │
│ Darstellung  │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```
