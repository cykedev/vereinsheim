# Plan: Spiegel — Disziplinen im Admin einordnen (Stufe 1)

> PIV-Handoff-Artefakt. Branch `feat/spiegel-disziplinen`, im Worktree
> `.claude/worktrees/spiegel-disziplinen-mapping-f1338a` (ADR-024). **Schema-Änderung mit Migration (T1, geschützter
> Pfad, interaktiv)**, kein Deploy-Vertrag, keine ADR berührt, **kein Update der Brücke** nötig. Ein Commit je Task.

## Context (warum)

Meyton nennt jede Disziplin nur mit DisziplinID und Namen; eine Tabelle der Disziplinen hat die SSMDB2 nicht. Spiegel
legt eine `Discipline` beim ersten Sehen an (`disciplineFor` in `apps/spiegel/src/lib/ingest/ingest.ts`) und rät dabei
Scheibenbild und Familie aus dem Fachkern. Danach lässt sich nichts mehr ändern (`setDisciplineFamily` hat keinen
Aufrufer). Folgen heute:

- Die amtliche Wertung (`officialScoring`) bleibt immer leer (SF-74). Ein Wettkampf zählt deshalb nie in der Wertung der
  Disziplin.
- Die Schusszahl kommt nur aus den letzten drei Ziffern der ID. „Kranzl LG“ (`19200020`, geschossen 3) ist so immer
  unvollständig, „LG 40 nachhalten“ (`19000010`, geschossen 11) immer über Soll. Unvollständige zählen nie für Rekorde.
- Scheiben ohne Familie oder Scheibenbild fehlen in allen Übersichten (`listable` in `apps/spiegel/src/lib/pages.ts`),
  ohne Scheibenbild antwortet auch die Seite der Scheibe 404. Eine vereinseigene Disziplin, die der Fachkern nicht
  kennt, verschwindet still.
- Benennt der Verein eine Disziplin in Meyton um (gleiche Nummer, neuer Name), entsteht eine neue `Discipline`, und
  alles, was der Admin festgelegt hat, wäre weg.
- Die Familie bestätigt niemand (SF-64), eigene Familien gibt es nicht.

Datenlage (Kopie der Vereinsanlage vom 9. Oktober 2026, nur gezählt): 39 Disziplinen, 1.532 Scheiben. 14 sportliche
(LG/LP 20, 40, 60, „alt“, Auflage 30, Liga) tragen rund 90 % der Scheiben und kennt der Katalog. Dazu kommen
Zimmerstutzen, König LG/LP (verdeckt, kommt nie hoch), Kranzl, „LG 40 nachhalten“, Meytons Trainingsscheiben,
„LG Training Spiegel“ und 18 Vereinsspiele. Die Anzeige am Stand passt klar zur Wertung: LG 40 alt zu 96 % ganze Ringe,
LG Auflage 30 zu 95 % Zehntel.

**Leitregel (Vorgabe des Users):** Der Verein definiert gelegentlich neue Disziplinen. Spiegel muss jederzeit mit einer
Disziplin zurechtkommen, die es noch nie gesehen hat. Eine Scheibe darf „unkonfiguriert“ ankommen; nichts geht
verloren, und sobald ein Admin die Disziplin einordnet, erscheinen die wartenden Scheiben von selbst, richtig gerechnet.

## Annahmen (bitte vor der Freigabe prüfen)

Der Vorschlag mit den offenen Fragen hat den User nicht erreicht. Der Plan nimmt deshalb diese Antworten an:

- **A1** Spaßscheiben lassen sich **ignorieren** (Wunsch des Users): Meytons Vereinsspiele (Schach, Balken, Dart, …) und
  Trainingsscheiben schlägt Spiegel von selbst zum Ignorieren vor, eine vereinseigene wie „LG Training Spiegel“
  ignoriert der Admin mit einem Klick. Ignorierte Scheiben bleiben gespeichert (Ignorieren ist jederzeit umkehrbar),
  Spiegel zeigt sie nirgends. Zimmerstutzen bekommt „Eigene Scheibe“: Spiegel zeigt ihn in Stufe 1 noch nicht, ein
  neutrales Raster für Scheiben ohne Scheibenbild (SF-17) ist ein eigenes Feature, und dann erscheint er.
- **A2** Beim Eintreffen gilt der Vorschlag des Fachkerns sofort, wie heute: Katalog und Name ergeben Scheibenbild und
  Familie, die Scheiben sind gleich sichtbar. Ohne Vorschlag wartet die Scheibe. In beiden Fällen bekommt der Admin eine
  Aufgabe.
- **A3** Die amtliche Wertung setzt nur der Admin. Spiegel zeigt dazu, was am Stand meist angezeigt wurde, setzt es
  aber nie selbst (SF-74).
- **A4** König LG/LP: Anzeigeart 5 (verdeckt), die Brücke schickt sie nie. Nichts zu tun.
- **A5** Eine gebündelte Aufgabe in der Übersicht für alle neuen Disziplinen mit Scheiben, keine je Disziplin.

## Approach

**Ankommen wie die Listen, einordnen beim Admin.** Das Einlesen legt eine Disziplin weiter beim ersten Sehen an, mit
dem Vorschlag des Fachkerns. Neu ist eine Zeit `confirmedAt`: Solange sie fehlt, ist die Disziplin „neu“, und die
Übersicht des Admins zeigt eine Aufgabe. Was eine Zuordnung festlegt:

| Feld | Speicher | Wirkt auf | Nachrechnen |
|---|---|---|---|
| Scheibe | `Discipline.targetId` (`lg-10m`, `lp-10m`, null = eigene Scheibe) | Zeichnen, Gegenprobe je Schuss, Merkmale `disziplin-unbekannt`/`scheibe-passt-nicht`, Sichtbarkeit | ja (Merkmale, Schüsse, Projektion) |
| Familie | `Discipline.familyId`, mitgeführt in `Card.familyId` | Liste, Fortschritt, Start, Sichtbarkeit | sofort in derselben Transaktion (`moveDisciplineFamily`) |
| Wertung im Wettkampf | `Discipline.officialScoring` | `cardScoring` beim Lesen | nein (gilt beim Lesen) |
| Schusszahl | `Discipline.plannedShots` (null = aus der ID, 0 = keine feste, sonst die Zahl) | `vollstaendig`/`unvollstaendig`/`ueber-soll`, `Card.complete`, Rekorde | ja (Merkmale) |
| Ignorieren | `Discipline.ignoredAt` | nirgends gezeigt (Start, Scheiben, Fortschritt, Seite der Scheibe, „Offen“), keine Aufgabe, kein Hinweis auf Start | nein (gilt beim Lesen) |

**Ignorieren ist etwas anderes als „Eigene Scheibe“.** „Eigene Scheibe“ heißt: Spiegel kann die Scheiben noch nicht
zeichnen, zeigt sie aber, sobald es das kann. „Ignorieren“ heißt: nie zeigen, egal was Spiegel kann. Die Scheiben
werden weiter angenommen und gespeichert. So bleibt es umkehrbar, und die Brücke braucht kein Update. Dass die Brücke
ignorierte Disziplinen gar nicht erst schickt, ist Stufe 2 (über `GET /state`). Neue Disziplinen aus Meytons Spielen und
Trainingsscheiben (Katalog: Regeln 8000 bis 8154, 9001, 9002) legt das Einlesen gleich als ignoriert an, als Vorschlag
mit Aufgabe „prüfen“; eine neue Spaßdisziplin des Vereins mit eigener Nummer kommt als „Neu“ an und ist mit einem Klick
ignoriert.

**Nachrechnen über Versionen, wie die Projektion.** `Discipline.version` steigt, wenn sich Scheibe oder Schusszahl
ändern. Jede Scheibe merkt sich, mit welcher Version ihre Merkmale gerechnet sind (`Card.disciplineVersion`). Ein Lauf
`refreshStaleDisciplineCards` holt die abweichenden nach: nach dem Speichern über `after()` aus `next/server` und beim
Start des Servers (übersteht einen Neustart mitten im Lauf). Er rechnet aus den gespeicherten Schüssen der aktuellen
Revision: Gegenprobe je Schuss (`verdaechtig`), Merkmale der Scheibe, `complete`, Projektion. Rohdaten neu deuten ist
nicht nötig: alle Felder der Gegenprobe stehen in `Shot`. Die Gegenprobe und die Merkmale der Disziplin ziehen dafür aus
dem Adapter in ein reines Modul, das Adapter und Nachrechnen teilen; so rechnen beide gleich.

**Neue Stände nehmen die Zuordnung mit.** Das Einlesen liest `targetId`, `plannedShots` und `version` der bekannten
Disziplin, gibt Scheibe und Schusszahl an den Adapter und die Version an `writeRevision`. Ändert ein Admin dazwischen
etwas, korrigiert der nächste Lauf die Scheibe: der Lauf nach dem Speichern, beim Start und stündlich (ein Stand, der
nach dem Lauf mit der alten Version ankommt, wartet sonst bis zum Neustart).

**`verdaechtig` ist keine Korrektur.** `sameScoring` vergleicht heute die Merkmale eines Schusses mit
(`shotContent`, `apps/spiegel/src/lib/db/cards.ts`). Ein Schuss, der durch die Gegenprobe `verdaechtig` wird oder es
nicht mehr ist, gilt deshalb als Korrektur: neue Revision und für immer `korrigiert`. Das passiert schon heute, wenn
mit späteren Schüssen `scheibe-passt-nicht` kippt; mit dem Nachrechnen passierte es regelmäßig (der nächste Stand
käme mit anderen Merkmalen als die nachgerechneten). `verdaechtig` ist Spiegels Lesart, nicht Meytons Wertung (SF-67):
`sameScoring` lässt es künftig außer Acht, ein Wechsel ist eine Änderung der aktuellen Revision. Schon gesetzte
`korrigiert` bleiben stehen.

**Gleiche Merkmale aus Rohdaten und aus `Shot`.** Das Merkmal eines Platzhalterschusses (SF-15, Lage 0/0 und Teiler 0)
leitet der Adapter heute aus `Teiler01` ab, das `Shot` nicht speichert. Eine Funktion `baseShotFlags` rechnet die
Merkmale eines Schusses künftig nur aus Feldern, die auch `Shot` hat; Adapter und Nachrechnen nutzen sie. Ein Test über
alle Fälle aus `ssmdb2-cases` belegt: einlesen, Version heben, nachrechnen ändert weder Merkmale noch `contentHash`, und
der nächste Stand bleibt `unchanged`.

**Umbenennen in Meyton.** Legt das Einlesen eine Disziplin an und gibt es an der Anlage schon eine eingeordnete mit
derselben Nummer, übernimmt die neue deren Zuordnung (Scheibe, Familie, Wertung, Schusszahl, Ignorieren) als Vorschlag
„nach gleicher Nummer“; eingeordnet ist sie erst, wenn der Admin sie prüft. So bleibt nichts verloren, und der Admin
sieht die Umbenennung.

**Eigene Familien.** `Family` hat schon freie `slug` und `name`. Der Admin legt Familien an (Kennung aus dem Namen,
fest nach dem Anlegen, sie steht in Adressen), benennt sie um und entfernt leere. Die vier des Fachkerns (`FamilyId`)
bleiben Vorschläge beim Einlesen; `FAMILY_NAMES` bleibt.

**Privat bleibt Standard.** Die Seite zeigt je Disziplin nur Zahlen über die ganze Anlage, nie Namen, Konten oder
Schüsse. Gelesen wird ohne `Shot`: die Anzeige aus `Card.standScoring`, die Schusszahl aus
`CardProjection.printedShots`. Weil die Kontenliste je Konto den Tag der letzten Scheibe zeigt, ließe sich ein genauer
Tag je Disziplin einem Konto zuordnen (der Hinweistext v2 sagt: nie Disziplinen je Konto). Deshalb nennt die Seite die
letzte Scheibe nur mit Monat, und Anzeige am Stand und häufigste Schusszahl erst ab drei verschiedenen Schützen.

**Ignorieren an einer Stelle.** `VISIBLE_CARD` (`apps/spiegel/src/lib/db/visible.ts`) bekommt die Bedingung „Disziplin
nicht ignoriert“; damit filtern Start, Scheiben, Fortschritt, Blättern, die Seite der Scheibe, die Lagen, das Umstellen
von Wertung und Art und die Zahlen des Admins auf einmal. `PENDING_CARD` bleibt unverändert: Die Bestätigung der ersten
Scheibe gibt alle wartenden frei, auch ignorierte, sonst blieben sie für immer wartend. Nur das Lesen für „Offen“
(`pendingGroups`) und die Zahl dazu lassen ignorierte aus, ebenso der Papierkorb.

**Der Schütze erfährt, dass etwas wartet.** Start zeigt eine ruhige Zeile, wenn eigene Scheiben auf die Einordnung
warten (Disziplin neu und ohne Scheibe oder Familie). Kein Fachbegriff, keine Aufgabe für den Schützen.

**Brücke und Vertrag bleiben unverändert.** Die Brücke kennt keine Disziplinen: Sie hält nur Schüsse nach ihrer
Anzeigeart zurück (`apps/spiegel-bridge/internal/filter/filter.go`), `GET /state` enthält nichts über Disziplinen.
Stufe 1 ändert nur Spiegel; kein Gang ins Schützenhaus.

**Daten in Produktion.** Die Migration fügt nur Spalten und einen Index an. Bestehende Disziplinen sind danach „neu“ (am
ersten Tag eine Aufgabe „{n} neue Disziplinen prüfen“, gewollt). Meytons Spiele und Trainingsscheiben, die schon in
Produktion stehen, setzt die Migration per SQL einmal auf ignoriert (wie `suggestIgnore`, ohne `confirmedAt`); sonst
stünden sie als „Scheiben warten“ da, und jeder, der Schach geschossen hat, sähe den Hinweis auf Start. Ein Job beim
Start wäre dafür falsch: Er ignorierte nach einem „Wieder zeigen“ erneut. `version` 0 und `disciplineVersion` 0 passen
zueinander, kein Nachrechnen beim ersten Start.

**Nicht im Umfang** (später, eigene Pläne): Brücke meldet die Disziplinen der Anlage vorab und schickt ignorierte gar
nicht erst (Stufe 2: zusätzliches Feld in `heartbeatV1`, das ein `strictObject` ist, also Spiegel zuerst deployen;
zusätzliches Feld in `GET /state`; Ergänzung zu ADR-027; dann ist Ignorieren ohne Nachladen nicht mehr umkehrbar), neutrales Raster für eigene Scheiben, Teiler als Wertung der Vereinsspiele, Art-Vorgabe je
Disziplin, Freigabe der Anzeigeart 0 je Disziplin (SP-1.5, braucht die Brücke), Anzeigename, Teilerfaktor, Neu-Werten
mit anderem Scheibenbild (SF-16, `neu-gewertet`).

## Required Docs

- [`apps/spiegel/CLAUDE.md`](../apps/spiegel/CLAUDE.md) (Schichten, Kein Knopf ohne Folge, Admin-Daten prüfen selbst,
  Projektion, Migrationen nur anhängen, Tests gegen die Dev-Datenbank)
- [`packages/shot-core/CLAUDE.md`](../packages/shot-core/CLAUDE.md)
- [`vault/conventions.md`](../vault/conventions.md) §8, §9 (Mocks filtern, Markup-Tests, Mutation), §10 (Design 2,
  `DecisionDialog`, So schreiben wir, `OLD_WORDS`)
- [`vault/spiegel/spiegel-target-library.md`](../vault/spiegel/spiegel-target-library.md) („Von der DisziplinID zum
  Scheibenbild“), [`vault/spiegel/spiegel-edge-cases.md`](../vault/spiegel/spiegel-edge-cases.md) (SF-02, SF-09, SF-15,
  SF-16, SF-17, SF-64, SF-66, SF-70, SF-74), [`vault/decisions/adr-031.md`](../vault/decisions/adr-031.md),
  [`vault/spiegel/spiegel-privacy.md`](../vault/spiegel/spiegel-privacy.md)
- Auto-Memory: Worktree-`.env`-Links, Node v24 in Bash, Stop-Gate prüft den Haupt-Checkout (Gate im Worktree selbst),
  `pnpm check && git commit`, Autopilot-Marker entfernen

## Textbuch-Auszug (neue Texte, vor dem Code von einem Menschen zu lesen)

Alle Texte ohne Pronomen für Personen, ohne Semikolon, ein Gedanke je Satz. `{…}` sind Werte.

**Reiter:** „Disziplinen“.

**Seite „Disziplinen“, Einleitung:** „Meyton nennt jede Disziplin mit Nummer und Namen. Hier legst du fest, wie
Spiegel ihre Scheiben zeigt und zählt. Neue Disziplinen legt Spiegel selbst an, sobald die erste Scheibe kommt.“

**Abschnitte:** „Neu“, je Familie ihr Name, „Ohne Familie“, „Ignoriert“ (eingeklappt, mit Zahl), „Familien“.

**Zeile:** „{Name}“ · „Nummer {DisziplinID}“ · „{n} Scheiben“ bzw. „noch keine Scheibe“ · Zustand:
- wartet: „Scheiben warten“
- Vorschlag: „Vorschlag“
- eingeordnet ohne Scheibenbild oder Familie: „wird nicht gezeigt“
- ignoriert, vom Fachkern vorgeschlagen und noch nicht geprüft: „Vorschlag: ignorieren“

Zeilen unter „Neu“ tragen rechts einen Knopf „Ignorieren“ (mit Dialog), Zeilen unter „Ignoriert“ einen Knopf „Wieder
zeigen“ (mit Dialog).

**Blatt einer Disziplin, Kopf:** „{Name}“, darunter „Nummer {DisziplinID} · {n} Scheiben · zuletzt im {Monat Jahr}“
(etwa „zuletzt im Oktober 2026“).

Zustand oben:
- wartet: „Spiegel kennt diese Disziplin nicht. Ihre Scheiben erscheinen erst, wenn du sie einordnest.“
- Vorschlag nach der Nummer: „Spiegel hat diese Disziplin an der Nummer erkannt. Bitte prüf den Vorschlag.“
- Vorschlag nach dem Namen: „Spiegel hat diese Disziplin am Namen erkannt. Bitte prüf den Vorschlag genau.“
- Vorschlag nach gleicher Nummer: „Eine Disziplin mit derselben Nummer hieß früher ‚{alter Name}‘. Spiegel hat ihre
  Einstellungen übernommen. Bitte prüf sie.“
- Vorschlag ignorieren: „Das ist ein Spiel oder eine Trainingsscheibe von Meyton. Spiegel ignoriert die Disziplin
  deshalb. Bitte prüf das.“
- ignoriert: „Spiegel ignoriert diese Disziplin. Ihre Scheiben zeigt Spiegel nirgends.“ Darunter statt der Felder nur
  der Knopf „Wieder zeigen“.

Feld „Scheibe“: Möglichkeiten „Luftgewehr 10 m“, „Luftpistole 10 m“ (die `label` aus `TARGETS`), „Eigene Scheibe“.
- Vorschlag: „Vorschlag nach der Nummer: {Scheibe}“ / „Vorschlag nach dem Namen: {Scheibe}“ / „Kein Vorschlag. Spiegel
  erkennt die Scheibe weder an der Nummer noch am Namen.“
- bei „Eigene Scheibe“: „Spiegel kennt diese Scheibe nicht. Ihre Scheiben zeigt Spiegel deshalb nicht.“

Feld „Familie“: „Scheiben einer Familie stehen zusammen in Liste und Fortschritt.“ Möglichkeiten: alle Familien,
„Keine“. Bei „Keine“: „Ohne Familie zeigt Spiegel die Scheiben nicht.“

Feld „Wertung im Wettkampf“: Möglichkeiten „Zehntel“, „Ganze Ringe“, „Nicht festgelegt“. Erklärung: „So zählt eine
Scheibe, die als Wettkampf gilt. Im Training gilt, was am Stand angezeigt wurde.“
- Anzeige am Stand: „Am Stand meist {Zehntel|ganze Ringe} angezeigt: {k} von {n} Scheiben.“ / ohne Scheiben mit Anzeige:
  „Am Stand wurde noch nichts angezeigt.“ / weniger als drei Schützen: „Dazu haben noch zu wenige Schützen diese
  Disziplin geschossen.“

Feld „Schusszahl“: Möglichkeiten „Wie in der Nummer: {n}“ (ohne Zahl in der Nummer: „Wie in der Nummer: keine feste“),
„Eigene Zahl“ (Eingabe 1 bis 200, Beschriftung „Schüsse“), „Keine feste“. Erklärung: „Nur eine Scheibe mit allen
Schüssen zählt für Rekorde.“
- Geschossen: „Meist geschossen: {k} Schüsse, bei {m} von {n} Scheiben.“ / „Noch keine Scheibe mit Wertungsschüssen.“
  / weniger als drei Schützen: derselbe Satz wie bei der Anzeige am Stand.

Knopf: „So einordnen“ (neu) bzw. „Übernehmen“ (eingeordnet, nur bei Änderung aktiv).

**Dialog `disciplineChange`:**
- Titel: „‚{Name}‘ so einordnen?“
- Worum es geht: „In Spiegel gibt es {n} Scheiben dieser Disziplin.“ / „In Spiegel gibt es eine Scheibe dieser
  Disziplin.“ / „In Spiegel gibt es noch keine Scheibe dieser Disziplin.“
- Was passiert, je geänderte Sache:
  - Scheibe auf ein Scheibenbild: „Spiegel zeichnet die Scheiben als {Scheibe} und prüft den Wert jedes Schusses nach.“
  - Scheibe auf eigene: „Spiegel zeigt die Scheiben dieser Disziplin nicht mehr in Start, Scheiben und Fortschritt.“
  - Familie auf eine Familie: „Die Scheiben stehen dann in der Familie ‚{Familie}‘.“
  - Familie auf keine: „Spiegel zeigt die Scheiben dieser Disziplin nicht mehr in Start, Scheiben und Fortschritt.“
    (nur einmal, auch wenn Scheibe und Familie beide wegfallen)
  - Wertung: „Ein Wettkampf in dieser Disziplin zählt dann in {Zehnteln|ganzen Ringen}.“ / „Ein Wettkampf in dieser
    Disziplin zählt dann so, wie am Stand angezeigt.“
  - Schusszahl: „Eine Scheibe ist dann mit {n} Schüssen vollständig.“ / „Eine Scheibe ist dann vollständig, sobald sie
    fertig ist.“
  - ohne Änderung (nur einordnen): „Spiegel übernimmt den Vorschlag. Die Disziplin steht danach nicht mehr unter ‚Neu‘.“
  - immer zuletzt: „Neue Scheiben dieser Disziplin kommen gleich so an.“ und bei geänderter Scheibe oder Schusszahl
    davor: „Spiegel rechnet die vorhandenen Scheiben in den nächsten Minuten neu.“
- Was nicht passiert: „An den Schüssen und an den Werten aus Meyton ändert sich nichts.“, „Hat ein Schütze eine Scheibe
  selbst auf Zehntel oder ganze Ringe gestellt, bleibt es dabei.“
- Rückgängig: „Jederzeit hier wieder umstellen.“
- Knopf: „So einordnen“, nicht destruktiv.

**Familien:** Einleitung „In einer Familie laufen Verläufe und Rekorde zusammen, etwa LG 40 und LG 40 alt.“ · Zeile
„{Name}“ · „{d} Disziplinen“ · Knöpfe „Umbenennen“, „Entfernen“ (nur ohne Disziplinen und ohne Scheiben) · Formular
„Neue Familie“, Feld „Name“, Knopf „Anlegen“.
- Fehler: „Bitte einen Namen eingeben.“, „Höchstens 40 Zeichen.“, „Diesen Namen hat schon eine Familie.“, „Zu dieser
  Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.“, „Das ließ sich nicht speichern. Bitte lade die
  Seite neu.“

**Dialog `familyRemove`:** Titel „Familie ‚{Name}‘ entfernen?“ · Worum: „Zu dieser Familie gehört keine Disziplin und
keine Scheibe.“ · Was passiert: „Die Familie verschwindet aus der Auswahl.“, „Hat ein Schütze für diese Familie Zehntel
oder ganze Ringe gewählt, fällt diese Wahl weg.“ · Was nicht: „Keine Scheibe ändert sich.“ · Rückgängig: „Eine neue
Familie mit demselben Namen anlegen. Die Wahl der Schützen kommt nicht zurück.“ · Knopf „Entfernen“, destruktiv.

**Dialog `disciplineIgnore`:** Titel „‚{Name}‘ ignorieren?“ · Worum: wie bei `disciplineChange` („In Spiegel gibt es
{n} Scheiben dieser Disziplin.“ usw.) · Was passiert: „Spiegel zeigt die Scheiben dieser Disziplin nirgends mehr. Auch
die Schützen sehen sie nicht.“, „Neue Scheiben dieser Disziplin kommen weiter an. Sie bleiben unsichtbar.“, „Die
Disziplin steht danach unter ‚Ignoriert‘.“ · Was nicht: „Keine Scheibe wird gelöscht.“, „An den Schüssen ändert sich
nichts.“ · Rückgängig: „Unter ‚Ignoriert‘ auf ‚Wieder zeigen‘ tippen. Dann sind alle Scheiben wieder da.“ · Knopf
„Ignorieren“, nicht destruktiv.

**Dialog `disciplineShow`:** Titel „‚{Name}‘ wieder zeigen?“ · Worum: wie oben · Was passiert: „Spiegel zeigt die
Scheiben dieser Disziplin wieder in Start, Scheiben und Fortschritt.“ und ohne Scheibenbild oder Familie statt dessen:
„Die Disziplin steht danach wieder unter ‚Neu‘. Ihre Scheiben erscheinen, sobald Scheibe und Familie eingestellt sind.“
· Was nicht: „An den Schüssen ändert sich nichts.“ · Rückgängig: „Jederzeit wieder ignorieren.“ · Knopf „Wieder
zeigen“, nicht destruktiv.

**Hilfe (`ADMIN_HELP`):**
- `discipline`: Titel „Disziplinen“, Text „Meyton speichert zu jeder Scheibe die Nummer und den Namen der Disziplin.
  Spiegel braucht dazu drei Dinge. Welche Scheibe gezeichnet wird. In welcher Familie die Scheiben stehen. Wie viele
  Schüsse eine vollständige Scheibe hat. Eine neue Disziplin legt Spiegel selbst an, sobald die erste Scheibe kommt.
  Spaßscheiben wie Schach lassen sich ignorieren.“
- `family`: Titel „Familien“, Text „In einer Familie laufen Verläufe und Rekorde zusammen. LG 40 und LG 40 alt sind zum
  Beispiel beide Luftgewehr. Eine eigene Familie lohnt sich, wenn Scheiben nicht mit den anderen verglichen werden
  sollen.“

**Aufgabe in der Übersicht:**
- mit wartenden Scheiben: Titel „Eine neue Disziplin: Scheiben warten“ / „{n} neue Disziplinen: Scheiben warten“,
  Text „Spiegel zeigt diese Scheiben erst, wenn du die Disziplin einordnest.“, Knopf „Einordnen“.
- sonst: Titel „Eine neue Disziplin prüfen“ / „{n} neue Disziplinen prüfen“, Text „Spiegel hat sie selbst eingeordnet.
  Ein kurzer Blick reicht.“, Knopf „Prüfen“.

**Start (Schütze):** „Eine Scheibe wartet darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheint sie hier von
selbst.“ / „{n} Scheiben warten darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheinen sie hier von selbst.“

## Tasks

### T1 — Schema und Migration (interaktiv, geschützter Pfad)

Dateien: `apps/spiegel/prisma/schema.prisma`, neue Migration.

1. `Discipline` ergänzen:
   ```prisma
     // Wertungsschüsse vom Admin; null: aus der DisziplinID, 0: keine feste Zahl (SF-09)
     plannedShots    Int?
     // vom Admin eingeordnet; null: neu, die Werte sind der Vorschlag des Fachkerns
     confirmedAt     DateTime? @db.Timestamptz(3)
     // steigt, wenn sich Scheibenbild oder Schusszahl ändern; Scheiben mit anderem Stand rechnet
     // `refreshStaleDisciplineCards` nach
     version         Int       @default(0)
     // ignoriert (Spaßscheiben): Spiegel zeigt ihre Scheiben nirgends, die Scheiben bleiben gespeichert; mit
     // `confirmedAt` null ein Vorschlag des Einlesens (Meytons Spiele und Trainingsscheiben)
     ignoredAt       DateTime? @db.Timestamptz(3)
   ```
2. `Card` ergänzen:
   ```prisma
     // `Discipline.version`, mit der Merkmale, Gegenprobe und `complete` gerechnet sind
     disciplineVersion Int             @default(0)
   ```
   und `@@index([disciplineId])` (Nachrechnen, `moveDisciplineFamily`, Zählen je Disziplin).
3. Den Kommentar an `Family.slug` anpassen: „Kennung, steht in der Adresse: aus dem Fachkern (`FamilyId`) oder beim
   Anlegen aus dem Namen; fest“.
4. `pnpm --filter spiegel exec prisma migrate dev --create-only --name discipline_mapping`. Die erzeugte SQL prüfen (nur
   `ADD COLUMN` und `CREATE INDEX`) und am Ende einmalig die vorhandenen Spiele und Trainingsscheiben von Meyton
   ignorieren (dieselbe Regel wie `suggestIgnore`: 10-m-ID, Regel 8000 bis 8154, 9001 oder 9002):
   ```sql
   -- Meytons Spiele und Trainingsscheiben, die schon da sind: ignoriert als Vorschlag (wie beim Einlesen)
   UPDATE "Discipline"
      SET "ignoredAt" = CURRENT_TIMESTAMP
    WHERE "meytonId" BETWEEN 10000000 AND 19999999
      AND ((("meytonId" / 1000) % 10000) BETWEEN 8000 AND 8154
           OR (("meytonId" / 1000) % 10000) IN (9001, 9002))
      AND "confirmedAt" IS NULL;
   ```
   Dann `pnpm --filter spiegel exec prisma migrate dev` (wendet sie an) und `prisma generate`.
5. In der Dev-Datenbank prüfen: `18051010` hätte `ignoredAt`, `19110040` nicht (mit zwei Testzeilen in einer
   Transaktion und `ROLLBACK`, oder am Bestand, falls vorhanden).
6. Gate. Commit `feat(spiegel): schema for admin discipline mapping`.

### T2 — Schusszahl der Zuordnung im Fachkern

Dateien: `packages/shot-core/src/discipline.ts`, `packages/shot-core/src/discipline.test.ts`.

1. Hinter `parseDisciplineId`:
   ```ts
   /** Soll der Wertungsschüsse: die Zahl des Admins (0: keine feste), sonst aus der DisziplinID (SF-09) */
   export function plannedShotsOf(meytonId: number, override: number | null): number | null {
     if (override === null) return parseDisciplineId(meytonId).plannedShots
     return override === 0 ? null : override
   }
   ```
2. `CatalogEntry` bekommt `fun?: true`. Die erste Katalogzeile wird geteilt: Meytons Vereinsspiele und
   Trainingsscheiben (`...ruleRange(8000, 8154), "9001", "9002"`) als eigene Zeile mit `target: null, fun: true`,
   Kyffhäuser, 12-kreisig, Löwenbräu und LP5 bleiben ohne `fun` (Sport mit eigener Scheibe). Dazu:
   ```ts
   /** Meytons Spiele und Trainingsscheiben: Vorschlag, die Disziplin zu ignorieren; vereinseigene erkennt nur der Admin */
   export function suggestIgnore(disciplineId: number): boolean {
     return catalogEntry(parseDisciplineId(disciplineId))?.fun === true
   }
   ```
3. Tests: `plannedShotsOf(19200020, null)` → 20, `plannedShotsOf(19200020, 3)` → 3, `plannedShotsOf(10110040, 0)` →
   null, `plannedShotsOf(10119000, null)` → null, `plannedShotsOf(123, null)` → null; `suggestIgnore(18051010)` (LG
   Schach 6x6) und `suggestIgnore(19001000)` (LP-Trainingsscheibe) true, `suggestIgnore(11062040)` (Kyffhäuser),
   `suggestIgnore(19110040)` und `suggestIgnore(10119000)` false; `resolveTarget` liefert für alle bisherigen Fälle
   dasselbe wie vorher (bestehende Tests unverändert grün).
4. Commit `feat(shot-core): planned shots override and ignore suggestion`.

### T3 — Gegenprobe und Merkmale der Disziplin als reines Modul

Dateien: `apps/spiegel/src/lib/ingest/card-checks.ts` (neu), `apps/spiegel/src/lib/ingest/card-checks.test.ts` (neu),
`apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`.

0. `sameScoring` in `apps/spiegel/src/lib/db/cards.ts` lässt `FLAG_SUSPICIOUS` außer Acht:
   ```ts
   const scoring = (shot: ShotInput) =>
     shotContent({ ...shot, displayMode: null, flags: shot.flags.filter((f) => f !== FLAG_SUSPICIOUS) })
   ```
   Kommentar ergänzen: „`verdaechtig` ist Spiegels Gegenprobe, nicht Meytons Wertung (SF-15, SF-67): ein Wechsel ist
   keine Korrektur“. Test in `cards.test.ts`: derselbe Stand, nur ein Schuss neu `verdaechtig` → `updated`, keine neue
   Revision, kein `korrigiert`; ein geänderter Zehntel bleibt `correction`.
1. `card-checks.ts` enthält, aus dem Adapter verschoben und unverändert im Verhalten:
   - `FLAG_UNKNOWN_DISCIPLINE`, `FLAG_TARGET_MISMATCH`, `INCOMPLETE_FLAGS`, `isComplete` (der Adapter re-exportiert sie
     mit `export { … } from "./card-checks"`, damit kein Importeur sich ändert).
   - ```ts
     /**
      * Merkmale eines Schusses aus seinen Werten (SF-08, SF-14, SF-15), nur aus Feldern, die auch `Shot` speichert:
      * über Soll (Platzhalter-Teiler, als `distanceTenthsUm` null gespeichert), Platzhalter 0/0 mit Abstand 0,
      * Fehlschuss. Adapter und Nachrechnen rufen dieselbe Funktion.
      */
     export function baseShotFlags(shot: {
       xUm: number | null; yUm: number | null; distanceTenthsUm: number | null; decimalTenths: number | null
       overTarget: boolean
     }): string[]
     ```
     Der Adapter ersetzt `shotFlags` durch `baseShotFlags` (`overTarget` aus dem Platzhalter-Teiler der Rohdaten);
     das Nachrechnen liest `overTarget` aus dem gespeicherten `FLAG_OVER_TARGET` des Schusses. Ob „Teiler01 = 0“ und
     „`distanceTenthsUm` unter 10“ (Teiler001 in 0,1 µm) an allen Fällen dasselbe ergeben, belegt der Test in T5; wo
     nicht, bleibt die Regel des Adapters und das Nachrechnen übernimmt `verdaechtig` aus Platzhaltern unverändert
     (dann prüft `verifyShots` diese Schüsse nicht).
   - ```ts
     /** ein Schuss, wie die Gegenprobe ihn braucht; aus den Rohdaten (Adapter) oder aus `Shot` (Nachrechnen) */
     export interface CheckableShot {
       xUm: number | null
       yUm: number | null
       /** Abstand zur Mitte in 0,1 µm (`Teiler001`) */
       distanceTenthsUm: number | null
       decimalTenths: number | null
       ring: number | null
       innerTen: boolean
       /** Merkmale aus den Rohdaten (`fehlschuss`, über Soll), ohne `verdaechtig` */
       flags: readonly string[]
     }

     /**
      * Gegenprobe jedes Schusses gegen das Scheibenbild. Fast alle daneben: das Scheibenbild passt nicht (SF-16), dann ist
      * kein Schuss verdächtig; sonst sind die einzelnen verdächtig (SF-15). Ohne Scheibenbild wird nichts geprüft.
      */
     export function verifyShots(
       targetId: TargetId | null,
       shots: readonly CheckableShot[]
     ): { suspicious: boolean[]; targetMismatch: boolean }
     ```
     Rumpf: die Zeilen `const target = …` bis `const targetMismatch = …` aus `adaptSnapshot`, mit
     `distance: s.distanceTenthsUm !== null ? { um: s.distanceTenthsUm / 10, resolutionUm: 0.1 } : null`,
     `position: { xUm: s.xUm, yUm: s.yUm, resolutionUm: 10 }` (bei beiden nicht null), `officialDecimalTenths:
     s.decimalTenths`, `officialRing: s.ring`, `officialInnerTen: s.innerTen`, geprüft nur bei `s.flags.length === 0 &&
     s.decimalTenths !== null`; `suspicious[i] = !targetMismatch && checks[i] === "mismatch"`.
   - ```ts
     /** Merkmale der Scheibe, die an der Zuordnung der Disziplin hängen; das Nachrechnen ersetzt genau diese */
     export const MAPPING_FLAGS = [
       "leer", "nur-probe", "unvollstaendig", "ueber-soll", FLAG_UNKNOWN_DISCIPLINE, FLAG_TARGET_MISMATCH,
     ] as const satisfies readonly CardFlag[]

     export function mappingFlags(input: {
       sighterShots: number
       matchShots: number
       plannedShots: number | null
       targetId: TargetId | null
       targetMismatch: boolean
     }): CardFlag[]
     ```
     Rumpf: `classifyCompleteness` und die drei `flags.push` aus `adaptSnapshot` in derselben Reihenfolge.
2. `adaptSnapshot`: `AdapterContext` bekommt
   ```ts
     /** Soll der Wertungsschüsse aus der Zuordnung (`plannedShotsOf`); undefined: aus der DisziplinID */
     plannedShots?: number | null
   ```
   Die Rohschüsse werden für `verifyShots` auf `CheckableShot` abgebildet (`xUm: s.x * 10`, `ring: Math.floor(s.ring /
   10)`, `distanceTenthsUm: s.teiler001`, `flags: shotFlags(s)`); die Merkmale kommen aus `mappingFlags` mit
   `plannedShots: context.plannedShots !== undefined ? context.plannedShots : parseDisciplineId(discipline.meytonId).plannedShots`, danach
   wie bisher `FLAG_CLOCK`.
3. Tests `card-checks.test.ts`: mit `TARGETS["lp-10m"]` und den Teilern aus der Gegenprobe der Note (331,8 → 10,5;
   2656 → 7,6) passt alles; ein Schuss mit falschem Zehntel ist verdächtig; drei von vier falsch → `targetMismatch`,
   keiner verdächtig; ohne Scheibenbild nichts verdächtig, kein Mismatch; `mappingFlags` liefert `unvollstaendig` bei
   38 von 40, `[]` bei 40 von 40, `ueber-soll` bei 41, nichts bei `plannedShots: null`, `disziplin-unbekannt` ohne
   Scheibenbild.
4. `pnpm --filter spiegel test src/lib/ingest` muss ohne Änderung an `meyton-ssmdb2.test.ts` grün bleiben (Beleg, dass
   sich das Verhalten nicht ändert). Commit `refactor(spiegel): share shot verification and discipline flags`.

### T4 — Einlesen nimmt die Zuordnung mit

Dateien: `apps/spiegel/src/lib/ingest/ingest.ts`, `apps/spiegel/src/lib/db/disciplines.ts` (neu),
`apps/spiegel/src/lib/db/cards.ts`, `apps/spiegel/tools/seed-own.ts`, `apps/spiegel/src/lib/ingest/ingest.test.ts`.

1. `adaptAndWrite`: `known` wählt zusätzlich `meytonId`, `plannedShots`, `version`; an `adaptSnapshot` gehen
   `targetId` wie bisher und `plannedShots: known ? plannedShotsOf(known.meytonId, known.plannedShots) : undefined`.
   `disciplineFor` zieht nach `apps/spiegel/src/lib/db/disciplines.ts` (neu, exportiert), damit `tools/seed-own.ts`
   dieselbe Anlage nutzt statt eigener Upserts. Sie liefert auch `version` (neu angelegt 0). Beim Anlegen, in dieser
   Reihenfolge: gibt es an der Anlage eine eingeordnete Disziplin mit derselben `meytonId` (die jüngst eingeordnete),
   übernimmt die neue deren `targetId`, `familyId`, `officialScoring`, `plannedShots` und `ignoredAt` (`confirmedAt`
   bleibt null); sonst der Vorschlag des Fachkerns wie bisher, und `ignoredAt: new Date()`, wenn
   `suggestIgnore(meytonId)` gilt. Die Scheibe geht mit
   `disciplineVersion: discipline.version` an `writeRevision`. Ignorierte Disziplinen werden weiter eingelesen und
   gespeichert wie jede andere.
2. `CardInput` bekommt
   ```ts
     /**
      * `Discipline.version`, mit der der Adapter gerechnet hat; fehlt (`seed:own`, PDF): -1, dann rechnet
      * `refreshStaleDisciplineCards` die Scheibe einmal mit der Zuordnung nach
      */
     disciplineVersion?: number
   ```
   `cardFeatures` setzt `disciplineVersion: card.disciplineVersion ?? -1`.
3. Tests in `ingest.test.ts`: (a) Disziplin mit `plannedShots: 3` und eine endgültige Scheibe mit drei Wertungsschüssen
   → `complete` true, keine `unvollstaendig`; (b) eine neue Scheibe trägt `disciplineVersion` der Disziplin
   (Disziplin vorher auf `version: 2` gesetzt); (c) ein synthetischer Stand (aus einem Fall von `ssmdb2-cases`, nur
   `DisziplinID` auf `18051010` und `Disziplin` auf „LG Schach 6x6“ gesetzt; `ssmdb2-cases` hat kein Spiel) legt die
   Disziplin mit `ignoredAt` und ohne `confirmedAt` an, die Scheibe ist gespeichert; (d) umbenannt: eingeordnete
   Disziplin `19110040` „LG 40 alt“ mit Familie und `plannedShots`, ein Stand mit `19110040` „LG 40“ legt eine neue,
   nicht eingeordnete Disziplin mit denselben Werten an; (e) `seed:own`-Pfad (`writeRevision` ohne
   `disciplineVersion`) speichert -1.
4. Commit `feat(spiegel): ingest applies the discipline mapping`.

### T5 — Nachrechnen nach einer Änderung

Dateien: `apps/spiegel/src/lib/db/cards.ts`, `apps/spiegel/src/lib/db/cards-discipline.test.ts` (neu),
`apps/spiegel/src/instrumentation-node.ts`.

1. `setDisciplineFamily` teilen: `export async function moveDisciplineFamily(tx: Tx, disciplineId: number, familyId:
   number | null): Promise<number>` macht die beiden Updates, `setDisciplineFamily` ruft sie in seiner Transaktion.
2. Neu in `cards.ts`:
   ```ts
   /**
    * Scheiben, deren Merkmale mit einer älteren Zuordnung ihrer Disziplin gerechnet sind (`Card.disciplineVersion`),
    * aus den gespeicherten Schüssen neu rechnen: Gegenprobe je Schuss, Merkmale der Disziplin, `complete`, Projektion.
    * Je Scheibe unter der Sperre ihrer Zeile; Rohdaten werden nicht neu gedeutet.
    */
   export async function refreshDisciplineCards(
     db: Db,
     { limit = 200, sourceId, exclude = [], onFailure }: { limit?: number; sourceId?: number; exclude?: readonly string[]; onFailure?: (cardId: string, error: unknown) => void } = {}
   ): Promise<number>
   ```
   Auswahl: `SELECT c.id FROM "Card" c JOIN "Discipline" d ON d.id = c."disciplineId" WHERE c."disciplineVersion" <>
   d.version` (plus `sourceId`, `exclude`), `ORDER BY c.id LIMIT`. Je Scheibe in einer Transaktion:
   - `SELECT c."currentRevisionId", c.state, c.flags, d."targetId", d."plannedShots", d."meytonId", d.version FROM
     "Card" c JOIN "Discipline" d ON d.id = c."disciplineId" WHERE c.id = … FOR UPDATE OF c`
   - die Schüsse der aktuellen Revision (`shotFromRow`); je Schuss die Merkmale neu aus `baseShotFlags` (T3), dann
     `verifyShots(targetId, …)` und `verdaechtig` dazu; weicht ein Schuss ab, dessen Zeile `flags` setzen und
     `CardRevision.contentHash` mit `contentHash` über die neuen Schüsse neu schreiben (wie `update` in
     `writeRevision`; dank T3 Schritt 0 wird der nächste Stand dadurch keine Korrektur)
   - Merkmale: `[...mappingFlags({ sighterShots, matchShots, plannedShots: plannedShotsOf(meytonId, plannedShots),
     targetId, targetMismatch }), ...flags.filter((f) => !MAPPING_FLAGS.includes(f))]`, `complete: isComplete(state,
     merkmale)`, `disciplineVersion: version`
   - `saveProjection` mit den neuen Schüssen; ohne aktuelle Revision nur `disciplineVersion` setzen.
   Dazu `refreshStaleDisciplineCards(db)` mit derselben Schleife wie `refreshStaleProjections` (Runden zu 200,
   gescheiterte über `exclude` überspringen, `MAX_REFRESH_ROUNDS`).
3. `instrumentation-node.ts`: beim Start neben `refreshStaleProjections` und danach stündlich im selben Takt wie der
   Papierkorb `refreshStaleDisciplineCards(db)`; Fehler mit `.catch`, geloggt nur mit `error.name` und der Zahl der
   Scheiben (Regel „Logs nur mit Zahlen und festen Codes“).
4. Tests gegen die Dev-Datenbank (`createTestSite`, `test/generate.ts`), alle mit `sourceId`:
   - Disziplin ohne Scheibenbild, Scheibe mit 40 LP-Schüssen: Merkmal `disziplin-unbekannt`. `targetId` auf `lp-10m`,
     `version` +1, `refreshDisciplineCards` → Merkmal weg, `disciplineVersion` gleich, Projektion neu (`computedAt`
     später).
   - Ein Schuss mit verfälschtem Zehntel wird nach dem Nachrechnen `verdaechtig`, die Projektion `suspicious`.
   - `plannedShots: 3` an einer Scheibe mit drei Wertungsschüssen: `unvollstaendig` weg, `complete` true; zurück auf
     null (ID sagt 40): wieder `unvollstaendig`.
   - `korrigiert` und `uhr-abweichung` bleiben stehen.
   - Eine Scheibe mit gleicher Version wird nicht angefasst (Rückgabe 0).
   - **Gleichheit mit dem Adapter** über alle eingefrorenen Fälle von `@vereinsheim/ssmdb2-cases/frozen`: einlesen,
     `version` der Disziplin +1 ohne andere Änderung, nachrechnen → `Shot.flags`, `Card.flags`, `complete` und
     `contentHash` unverändert; danach den letzten Stand noch einmal mit höherer Folgenummer einlesen → `unchanged`.
   - Wettlauf: Stand mit altem Scheibenbild nach dem Nachrechnen geschrieben → `disciplineVersion` alt, der nächste
     Lauf rechnet ihn nach, keine neue Revision, kein `korrigiert`.
   - Gegenprobe der Tests per Mutation: `MAPPING_FLAGS`-Filter testweise entfernen → ein Test wird rot (Backup per `cp`,
     nicht `git checkout`).
5. Commit `feat(spiegel): recompute cards after a discipline mapping change`.

### T6 — Lesen für die Seite „Disziplinen“

Dateien: `apps/spiegel/src/lib/admin/discipline-model.ts` (neu, rein), `apps/spiegel/src/lib/admin/discipline-model.test.ts`
(neu), `apps/spiegel/src/lib/admin/disciplines.ts` (neu), `apps/spiegel/src/lib/admin/disciplines.test.ts` (neu).

1. `discipline-model.ts` (ohne `db`, darf in den Client):
   ```ts
   export type DisciplineStatus = "waiting" | "suggested" | "confirmed" | "ignored"
   export interface DisciplineStats {
     cards: number
     /** verschiedene Besitzer; Anzeige am Stand und Schusszahl erst ab `MIN_OWNERS_FOR_STATS` (3) */
     owners: number
     /** nur Monat und Jahr („Oktober 2026“), nie der Tag (Datenschutz) */
     lastCardMonth: string | null
     /** Scheiben je Anzeige am Stand (`Card.standScoring`) */
     stand: { decimal: number; rings: number }
     /** häufigste Zahl der Wertungsschüsse (`printedShots`, ohne nur Probe) und wie oft; null ohne */
     shots: { count: number; cards: number; of: number } | null
   }
   export interface DisciplineRow {
     id: number; meytonId: number; name: string
     targetId: TargetId | null; familyId: number | null; familyName: string | null
     officialScoring: Scoring | null; plannedShots: number | null; confirmed: boolean; ignored: boolean
     status: DisciplineStatus
     /** sichtbar in den Übersichten: Scheibenbild und Familie */
     visible: boolean
     suggestion: {
       targetId: TargetId | null; source: "catalog" | "name" | "unknown"; plannedShotsFromId: number | null
       ignore: boolean
       /** Name der eingeordneten Disziplin mit derselben Nummer, von der das Einlesen übernommen hat; null ohne */
       sibling: string | null
     }
     stats: DisciplineStats
   }
   export function disciplineStatus(d: {
     confirmed: boolean; ignored: boolean; targetId: TargetId | null; familyId: number | null
   }): DisciplineStatus
   export function disciplineRow(input: {
     discipline: {
       id: number; meytonId: number; name: string; targetId: string | null; officialScoring: Scoring | null
       plannedShots: number | null; confirmedAt: Date | null; ignoredAt: Date | null
       family: { id: number; name: string } | null
     }
     stats: DisciplineStats
   }): DisciplineRow
   ```
   (`targetId` über `isTargetId` aus `reads.ts` eingeengt, ein unbekannter Wert gilt als null.)
   `status`: bestätigt und ignoriert → `ignored`; bestätigt → `confirmed`; nicht bestätigt und (ignoriert oder sichtbar)
   → `suggested`, sonst `waiting`. `visible` ist false bei `ignored`. `suggestion` aus
   `resolveTarget({ disciplineId: meytonId, name })` (Quelle `admin` gibt es dort nicht, weil ohne `adminMappings`
   gerufen), `parseDisciplineId(meytonId).plannedShots` und `suggestIgnore(meytonId)`. Dazu die Satzbausteine des Textbuchs für Zustand,
   Vorschlag, Anzeige am Stand und Schusszahl als Funktionen (`statusText`, `targetSuggestionText`, `standText`,
   `shotsText`).
2. `disciplines.ts` (jede Funktion `requireAdmin`, Anlage = erste):
   - `disciplineOverview(timeZone)`: Disziplinen mit Familie; `card.groupBy` nach `disciplineId` (`deletedAt: null`,
     `_count`, `_max.startedAt`, Monat über `formatMonthYear` aus `@vereinsheim/lib/format`), nach `[disciplineId, ownerId]` (Zahl der Besitzer) und nach
     `[disciplineId, standScoring]`; `sibling`: nicht eingeordnete Disziplin, deren Werte einer eingeordneten mit
     derselben `meytonId` gleichen; `$queryRaw` für die Schusszahl:
     `SELECT c."disciplineId", p."printedShots", count(*)::int AS n FROM "Card" c JOIN "CardProjection" p ON
     p."cardId" = c.id WHERE c."deletedAt" IS NULL AND NOT p."probeOnly" AND c."disciplineId" = ANY(${ids}) GROUP BY 1, 2`;
     Familien mit Zahl der Disziplinen und Scheiben. Rückgabe `{ rows: DisciplineRow[]; families: FamilyRow[] }`,
     sortiert: `waiting`, `suggested`, dann nach Familie und Scheibenzahl absteigend, `ignored` zuletzt.
   - `disciplineDetail(id, timeZone)`: dieselbe Zeile für eine Disziplin der Anlage, sonst null.
   - `disciplineTaskCounts()`: `{ waiting, suggested }` über nicht bestätigte Disziplinen mit mindestens einer nicht
     gelöschten Scheibe.
3. Tests: das reine Modell für alle vier Zustände (ein nicht bestätigter ignorierter Vorschlag ist `suggested`, nicht
   sichtbar), die Vorschläge für `19110040` (Katalog), `19000001` „König LG“ (Name), `10199005` „Zimmerstutzen“
   (unbekannt), `19200020` (Schusszahl 20 aus der ID), `18051010` (ignorieren); `disciplines.ts` gegen die
   Dev-Datenbank: Zahlen stimmen, gelöschte Scheiben zählen nicht, eine Disziplin einer fremden Anlage fehlt; kein Feld
   mit Namen, Konto, Sportpass oder Tag im Ergebnis (Schlüssel prüfen); bei zwei Besitzern keine Anzeige am Stand und
   keine Schusszahl, bei drei beides.
4. Commit `feat(spiegel): admin reads for disciplines`.

### T7 — Texte

Dateien: `apps/spiegel/src/lib/admin/consequences.ts`, `apps/spiegel/src/lib/admin/consequences.test.ts`,
`apps/spiegel/src/lib/admin/help.ts`, `apps/spiegel/src/lib/admin/help.test.ts`.

1. `disciplineChange({ name, cards, before, after, targetLabel, familyName })` → `Decision`, Wortlaut genau wie im
   Textbuch-Auszug; `before`/`after` haben `targetId`, `familyId`, `officialScoring`, `plannedShots` (gespeichert:
   null/0/Zahl) und `confirmed`. Exportiert dazu `disciplineRecalculates(before, after)` (Scheibe oder Schusszahl
   geändert), die auch T8 nutzt.
2. `familyRemove({ name })`, `disciplineIgnore({ name, cards })`, `disciplineShow({ name, cards, visible })` →
   `Decision` wie im Auszug (`visible`: Scheibenbild und Familie gesetzt).
3. `ADMIN_HELP.discipline`, `ADMIN_HELP.family` wie im Auszug.
4. Tests halten den Wortlaut: nur einordnen, jede Änderung einzeln, Scheibe und Familie beide weg (Satz nur einmal),
   Nachrechnen-Satz nur bei Scheibe oder Schusszahl, ignorieren, wieder zeigen mit und ohne Scheibenbild; alle neuen
   Texte gegen `OLD_WORDS` (wie die bestehenden Tests).
5. Commit `feat(spiegel): texts for discipline mapping`.

### T8 — Server Actions

Dateien: `apps/spiegel/src/lib/admin/discipline-actions.ts` (neu, `"use server"`, nur direkt deklarierte async
Funktionen), `apps/spiegel/src/lib/admin/discipline-actions.test.ts` (neu, Muster aus `site-actions.test.ts`).

1. ```ts
   export async function saveDiscipline(
     disciplineId: number,
     input: {
       targetId: string            // Schlüssel aus TARGETS oder "own"
       familyId: number | null
       officialScoring: "decimal" | "rings" | "open"
       plannedShots: { mode: "id" } | { mode: "open" } | { mode: "count"; count: number }
     }
   ): Promise<ActionResult>
   ```
   `adminActor`; Zod (`count` ganzzahlig 1 bis 200, `isRowId` für die Kennungen); Disziplin und Familie müssen zur
   ersten Anlage gehören bzw. existieren, sonst „Das ließ sich nicht speichern. Bitte lade die Seite neu.“. In einer
   Transaktion: Zeile `FOR UPDATE`; ist sie ignoriert, derselbe Fehler (das Formular gibt es dann nicht);
   `disciplineRecalculates` aus der **gesperrten Zeile** gegen die Eingabe (nie aus dem, was der Browser zuvor sah),
   `version` +1 nur dann, `confirmedAt: now`, die Felder (`own` → null, `open` → null, `id` → null,
   `open`-Schusszahl → 0), bei anderer Familie `moveDisciplineFamily`. Danach `after(() =>
   refreshStaleDisciplineCards(db).catch(…))` (Log nur mit `error.name`), `revalidatePath("/", "layout")`,
   `{ success: true }`.
1a. `setDisciplineIgnored(disciplineId: number, ignored: boolean): Promise<ActionResult>`: `adminActor`, `isRowId`,
   Disziplin der ersten Anlage. Ignorieren: `ignoredAt: now`, `confirmedAt: now`. Wieder zeigen: `ignoredAt: null`,
   `confirmedAt: now`, wenn Scheibenbild und Familie gesetzt sind, sonst `confirmedAt: null` (dann steht sie wieder
   unter „Neu“, wie der Dialog sagt). 0 getroffen → „Das ließ sich nicht speichern. Bitte lade die Seite neu.“;
   `revalidatePath("/", "layout")`. Kein Nachrechnen (Ignorieren gilt beim Lesen).
2. `createFamily(_prev, formData)`: Name getrimmt, 1 bis 40 Zeichen, nicht schon vorhanden (ohne Groß/Klein); Kennung
   über `familySlug(name, taken)` (neu in `discipline-model.ts`: klein, ä→ae, ö→oe, ü→ue, ß→ss, sonst Nicht-Alnum →
   `-`, Ränder weg, höchstens 40; bei Kollision `-2`, `-3`, …; die vier Kennungen aus `FamilyId` gelten immer als
   vergeben, auch wenn es die Zeile noch nicht gibt, sonst legte das Einlesen später Scheiben in die eigene Familie
   des Admins). `renameFamily(familyId, name)`: gleiche Prüfung, Kennung
   bleibt. `removeFamily(familyId)`: `deleteMany` mit `disciplines: { none: {} }, cards: { none: {} }` in der Bedingung;
   0 gelöscht → „Zu dieser Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.“
3. Tests: Nicht-Admin abgewiesen; Scheibe ändern hebt `version`, Wertung allein nicht; `confirmedAt` gesetzt auch ohne
   Änderung; Familienwechsel zieht `Card.familyId` mit; Schusszahl `count`/`open`/`id` speichert 3/0/null; fremde
   Familie abgewiesen; ignorieren setzt `ignoredAt` und `confirmedAt`, wieder zeigen leert `ignoredAt` (ohne
   Scheibenbild auch `confirmedAt`); Speichern einer ignorierten abgewiesen; `familySlug("LG Freihand")` →
   `lg-freihand-2`; `familySlug("Zimmerstutzen 15 m")` → `zimmerstutzen-15-m`, `familySlug("Ölpreis")` → `oelpreis`,
   Kollision → `-2`; doppelter Name abgewiesen; Familie mit Disziplin nicht entfernbar (das Mock bzw. die Dev-Datenbank
   enthält die Zeile, die die Bedingung ausschließt).
4. Commit `feat(spiegel): admin actions for disciplines and families`.

### T9 — Oberfläche

Dateien: `apps/spiegel/src/components/admin/AdminTabs.tsx`, `apps/spiegel/src/app/(app)/admin/disciplines/page.tsx`
(neu), `apps/spiegel/src/app/(app)/admin/disciplines/[id]/page.tsx` (neu),
`apps/spiegel/src/components/admin/DisciplineList.tsx` (neu), `apps/spiegel/src/components/admin/DisciplineForm.tsx`
(neu), `apps/spiegel/src/components/admin/FamilyForms.tsx` (neu), Markup-Tests `DisciplineList.test.tsx`,
`DisciplineForm.test.tsx` (neu), `apps/spiegel/src/lib/admin-path.test.ts`.

1. `AdminTabs`: `AdminTab` um `"disciplines"`, Reiter „Disziplinen“ zwischen „Konten“ und „Anlage und Brücke“.
2. Seiten wie `admin/site/page.tsx` aufgebaut (Rahmen, `AdminTabs`, `AdminHelp`), Daten aus `disciplineOverview` bzw.
   `disciplineDetail` (`notFound()` bei null), Zone über `getDisplayTimeZone()`.
3. `DisciplineList`: Abschnitte wie im Auszug; jede Zeile ist ein Link auf `/admin/disciplines/{id}` (ganze Zeile,
   conventions §7), Zustand als ruhiger Chip (`warning`-Ton für „Scheiben warten“, `foreground-2` sonst). Darunter
   `FamilyForms`: Liste mit „Umbenennen“ (Feld inline, gesteuert) und „Entfernen“ (nur ohne Disziplinen und Scheiben,
   `DecisionDialog` mit `familyRemove`), Formular „Neue Familie“ (gesteuert, `value` + `onChange`).
4. `DisciplineForm` (Client): Kopf und Zustand, vier Felder als `Segmented` aus `@vereinsheim/ui/design2` (Familie mit
   `wrap`), „Eigene Zahl“ mit einem Zahlenfeld; unter jedem Feld Vorschlag bzw. Beobachtung aus `discipline-model.ts`.
   Gesteuert; Absenden fängt `onSubmit` ab, zeigt `DecisionDialog` mit `disciplineChange`, ruft nach dem Bestätigen
   `saveDiscipline`; Fehler als Text über `getErrorMessage`, Erfolg führt zurück auf `/admin/disciplines`. Daneben der
   Knopf „Ignorieren“ (`DecisionDialog` mit `disciplineIgnore`, dann `setDisciplineIgnored(id, true)`); bei einer
   ignorierten Disziplin statt der Felder nur der Zustandssatz und „Wieder zeigen“ (`disciplineShow`).
   In `DisciplineList` tragen Zeilen unter „Neu“ den Knopf „Ignorieren“, Zeilen unter „Ignoriert“ (eingeklappt über
   `<details>`, Zusammenfassung „Ignoriert ({n})“) den Knopf „Wieder zeigen“; der Knopf liegt außerhalb des Links der
   Zeile.
5. Markup-Tests (`renderToStaticMarkup`): Liste zeigt „Scheiben warten“ für eine wartende Zeile und keinen Chip für eine
   eingeordnete sichtbare; „wird nicht gezeigt“ für eingeordnet ohne Scheibenbild; „Vorschlag: ignorieren“ und der
   Abschnitt „Ignoriert (1)“; das Formular zeigt „Wie in der
   Nummer: 40“ und den Satz zur Anzeige am Stand; „Entfernen“ fehlt an einer Familie mit Disziplinen.
   `admin-path.test.ts` um `/admin/disciplines` erweitern.
6. Commit `feat(spiegel): admin page for disciplines`.

### T10 — Ignorierte ausblenden, Aufgabe in der Übersicht, Hinweis auf Start

Dateien: `apps/spiegel/src/lib/db/visible.ts`, `apps/spiegel/src/lib/users/queries.ts`,
`apps/spiegel/src/lib/admin/overview.ts`, `apps/spiegel/src/lib/admin/overview.test.ts`,
`apps/spiegel/src/lib/db/reads.ts`, `apps/spiegel/src/lib/db/reads.test.ts`, `apps/spiegel/src/app/(app)/page.tsx`,
`apps/spiegel/src/components/start/StartScreen.tsx`, `apps/spiegel/src/components/start/StartScreen.test.tsx`
(neu oder bestehend erweitern), `apps/spiegel/src/lib/admin/consequences.test.ts` (`OLD_WORDS` über die neuen Texte).

0. `visible.ts`:
   ```ts
   /** Scheiben einer Disziplin, die der Admin nicht ignoriert (Spaßscheiben); gilt beim Lesen, nichts wird gelöscht */
   export const SHOWN_DISCIPLINE = { discipline: { ignoredAt: null } } as const

   export const VISIBLE_CARD = { deletedAt: null, ownerPending: false, ...SHOWN_DISCIPLINE } as const
   ```
   `PENDING_CARD` bleibt unverändert (die Bestätigung der ersten Scheibe gibt alle wartenden frei, auch ignorierte).
   `SHOWN_DISCIPLINE` zusätzlich in: `pendingGroups` (`reads.ts`; darüber auch `pendingFirstCards` für „Offen“ und
   `pendingCount` für die Zahl im Layout),
   `trashCards` und `trashCount` (Papierkorb), die Zahl der Wartenden je Konto in `src/lib/users/queries.ts` (so sieht
   der Admin dieselbe Zahl wie „Offen“). Danach `tsc`: jede Stelle, die `VISIBLE_CARD` in einem Ausdruck nutzt, der keine
   Relationsfilter erlaubt (etwa rohes SQL), meldet sich oder ist von Hand zu prüfen (`grep -rn "VISIBLE_CARD\|deletedAt"
   apps/spiegel/src`).
   Tests in `reads.test.ts`: eine Scheibe einer ignorierten Disziplin fehlt in `ownerCards`, `cardWithShots` (null),
   `pendingGroups`, `trashCards`; `chooseCardScoring` auf sie gibt false; nach „Wieder zeigen“ ist sie überall zurück; eine
   wartende erste Scheibe einer ignorierten Disziplin wird mit „Ja, meine“ an einer anderen Scheibe freigegeben
   (`first-card-actions.test.ts`).
1. `OverviewInput.disciplines: { waiting: number; suggested: number }`; `overviewModel` hängt nach den Zustimmungen eine
   Aufgabe `id: "disciplines"`, `href: "/admin/disciplines"` an, Wortlaut wie im Auszug (wartend geht vor).
   `adminOverview` liest `disciplineTaskCounts()`.
2. `reads.ts`: `waitingForDiscipline(db, ownerId)` zählt eigene Scheiben mit `VISIBLE_CARD`, deren Disziplin
   `confirmedAt: null`, `ignoredAt: null` und `targetId: null` oder `familyId: null` hat.
3. Start: `StartRoute` liest die Zahl mit, `StartScreen` bekommt `waiting: number` und zeigt bei > 0 über den Blöcken
   (auch im leeren Zustand) einen Absatz `text-sm text-foreground-2` mit dem Satz aus dem Auszug.
4. Tests: Aufgabe mit wartenden, mit nur vorgeschlagenen, keine ohne; `waitingForDiscipline` zählt keine gelöschte,
   keine wartende erste Scheibe (`ownerPending`), keine fremde, keine einer eingeordneten Disziplin; Start-Markup mit 0,
   1 und 3.
5. `pnpm --filter spiegel measure` (Relationsfilter in den Abfragen der Übersichten): Zeiten von Start und Liste mit
   denen vorher vergleichen und in den Commit schreiben; mehr als 20 % langsamer ist ein Circuit-Breaker.
6. Commit `feat(spiegel): hide ignored disciplines, task and start hint for new ones`.

### T11 — Doku

Dateien: `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-target-library.md`, `vault/spiegel/spiegel-edge-cases.md`,
`vault/spiegel/spiegel-roadmap.md`, `vault/spiegel/spiegel-db-schema.md`, `vault/spiegel/spiegel-data-model.md`,
`vault/spiegel/spiegel-privacy.md`.

1. `apps/spiegel/CLAUDE.md`: Regel „Disziplinen einordnen“ (Felder, `confirmedAt`, Versionen und
   `refreshStaleDisciplineCards`, Gegenprobe aus `card-checks.ts`, Familie nur über `moveDisciplineFamily`, Admin sieht
   je Disziplin nur Zahlen); `Admin → Disziplinen` in den Aufbau.
2. Target-Library: Schritt 1 „Admin-Zuordnung“ ist bedienbar, Schusszahl der Zuordnung vor dem Schusscode.
3. Edge-Cases: SF-17, SF-64, SF-70 „Admin-Zuordnung (noch nicht bedienbar)“ → bedienbar unter Admin → Disziplinen;
   Leitregel „neue Disziplin jederzeit“ an SF-17.
4. Roadmap: Einzelpunkt „Disziplinen im Admin pflegen“ entfernen; neue Einzelpunkte: Brücke meldet Disziplinen vorab
   (Stufe 2, Vertrag + Brücke), neutrales Raster für eigene Scheiben, Teiler-Wertung der Vereinsspiele, Art-Vorgabe je
   Disziplin; die Freigabe der Anzeigeart 0 bleibt bei SP-1.5.
5. DB-Schema und Datenmodell: neue Spalten, der Index auf `Card.disciplineId` (die Zeile „Nicht indiziert, weil
   selten: `Card.disciplineId`“ anpassen), `SHOWN_DISCIPLINE` in `VISIBLE_CARD`, die Migration mit dem einmaligen
   Ignorieren. Privacy: „Admin sieht je Disziplin Zahlen der ganzen Anlage, nie je Konto; die letzte Scheibe nur als
   Monat, Anzeige und Schusszahl erst ab drei Schützen“. `apps/spiegel/CLAUDE.md` zusätzlich: `verdaechtig` ist keine
   Korrektur (`sameScoring`), `baseShotFlags` für Rohdaten und `Shot`.
6. `vault-lint` grün (`/sync-graph`). Commit `docs(spiegel): discipline mapping in the vault`.

## Test steps

- Je Task: `pnpm --filter spiegel test <Datei>` bzw. `pnpm --filter @vereinsheim/shot-core test`.
- Nach T3: `meyton-ssmdb2.test.ts` unverändert grün.
- Vor jedem Commit: `pnpm check` (alle fünf Gates, im Worktree).

## Verification

1. `pnpm check` grün im Worktree.
2. Dev-Datenbank mit der Kopie (`seed:own` bzw. `dev-restore` durch den User), Dev-Server `:3002`, als Admin anmelden
   (meldet sich der User selbst an): `/admin/disciplines` zeigt die Disziplinen, Zahlen ohne Namen; eine Disziplin
   ohne Scheibenbild steht unter „Neu“ mit „Scheiben warten“, die Übersicht hat die Aufgabe.
3. Eine Disziplin auf „Luftpistole 10 m“ und eine Familie stellen, Dialog lesen, bestätigen: nach dem Lauf erscheinen
   ihre Scheiben in Liste und Start des Besitzers, `disziplin-unbekannt` ist weg (Abfrage in der Dev-Datenbank).
4. Schusszahl einer Disziplin auf eine eigene Zahl stellen: `Card.complete` und Merkmale folgen; Rekorde im Fortschritt
   zählen die Scheibe.
5. Familie anlegen, umbenennen (Adresse `?family=` bleibt gültig), leere entfernen.
5a. Eine Disziplin ignorieren: ihre Scheiben fehlen in Start, Scheiben, Fortschritt und Papierkorb des Besitzers, die
   alte Adresse einer Scheibe antwortet 404; „Wieder zeigen“ bringt alles zurück.
6. Eine neue Disziplin per Ingest (Fall aus `ssmdb2-cases` mit unbekannter DisziplinID über `bridge-e2e` oder
   `ingest.test.ts`) kommt an, wird angelegt, die Scheibe wartet, Start des Besitzers zeigt den Hinweis.
7. Was die Dev-Daten nicht hergeben, steht im Validierungsbericht als „nicht belegt“ mit dem Test, der den Pfad deckt
   (conventions §9).
