# Labor — Claude Scope-Notiz

Eine Seite aus den echten Bausteinen von Spiegel (`@vereinsheim/shot-ui`, Design-2-Bausteine aus
`@vereinsheim/ui`) mit erfundenen Beispielscheiben, gebaut zu einer einzigen HTML-Datei. Zum Ausprobieren
und Beurteilen, auch auf dem Handy als privates Artifact „Spiegel-Labor“
(https://claude.ai/artifact/RBdMhiyLsNvqbVDWvJH5Ni; aus einer anderen Session mit dieser Adresse als `url`
neu veröffentlichen). Plan: `plans/2026-10-08-spiegel-shot-ui-fundament.md`; Vorbild war die Spielwiese
(`tools/spielwiese`).

## Befehle

| Befehl                                     | Zweck                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `pnpm --filter @vereinsheim/labor build`   | `dist/labor.html` (für das Artifact) und `dist/preview.html` (Browser) |
| `pnpm --filter @vereinsheim/labor pruefen` | Skriptprüfung in Headless-Chrome (`pruefung.js`), `--alle` zeigt jede  |

## Regeln

- **Nur echte Bausteine:** Das Labor zeichnet und rechnet nichts selbst. Was es zeigen soll, kommt als
  Baustein nach `shot-ui` (mit Tests) und wird hier nur verdrahtet; Zahlen nur aus dem Fachkern.
- **Nach jeder Änderung** an Bausteinen oder Labor: `pruefen` muss „0 FAIL“ melden (nicht im Gate, braucht
  Chrome; `CHROME_PATH` für einen anderen Pfad). Neue Bedienung bekommt Prüfungen in `pruefung.js`.
- **Eigenheiten der Skriptprüfung** (Headless-Chrome mit `--dump-dom`): Klicks sind `cancelable`, sonst folgt der
  Browser einem Link trotz `preventDefault` und die Seite ist weg („Kein Bericht“). Helfer: `button`, `link` (nach Text
  oder `aria-label`), `area` (sichtbarer Eintrag der Navigation), `helpSheet` (das Blatt der Hilfe ist das letzte
  `<dialog>`; davor stehen das der Labor-Werkzeuge und je Seite weitere), `inLabor` (Knopf im Blatt der
  Labor-Werkzeuge, auch geschlossen; nur dort suchen, die Seite hat gleich benannte Knöpfe wie den Reiter „Probe“),
  `sideTheme` (Darstellung in der Seitenleiste), `pageHeadTop` (Abstand des Seitenkopfs oben); der Pillen-Helfer
  übergeht „Zurück zur App“. Ein synthetischer Klick fokussiert
  nicht und eine synthetische Taste löst keine Aktion aus (Tastatur nur über echte, fokussierbare Knöpfe
  prüfen); das `close`-Ereignis eines `<dialog>` kommt spät oder gar nicht (nie darauf warten; Escape-Weg
  über `requestClose()`, das synchrone `cancel`). Die Prüfung läuft nur mit `#pruefen`, ein Abbruch steht als FAIL im Bericht;
  `window.__labor` (Prüfhaken) liefert Schüsse, Zustand, Scheibe, die Funktionen des Fachkerns (auch die
  Analyse), `analysisInput`, `overviewTiles`, `observations` und die Hilfe-Daten zum Nachrechnen, auf der Seite
  eines Zeitraums dazu `period` (Scheiben, Zustand, Modell) und `tools.period`, auf der Scheiben-Liste `list` (Modell,
  Filter, Scheiben, Familie je Id), auf Start `start` (Modell, Scheiben). Die Prüfung braucht seit L3 mehr
  als 40 s virtuelle Zeit (Budget 90 s in `scripts/pruefen.ts`).
  In den Rahmen der Prüfung (außerhalb des Bilds, `left:-9999px`) kam ein Sprung über `requestAnimationFrame` beim
  Laden nicht an; was beim Laden zu einem Anker springen soll, springt deshalb im Effekt sofort (Review N2).
- **Die App im Rahmen** (Plan L3, N2, N3): `AppFrame` umgibt jede Ansicht; die Navigation wechselt die Bereiche
  (Start `StartView` seit N5, Scheiben `ListView`, Fortschritt `PeriodView`, Platzhalter `PlaceholderView` für
  Scannen, Profil, Admin). „Offen“ auf Start zeigt zwei Beispiele (`OPEN_EXAMPLES`); ihre Zahl steht am Rahmen.
  - **Kein Labor-Kopf** (Labor näher an der App, `plans/2026-10-09-spiegel-labor-wie-app.md`): Die Seiten beginnen wie
    in der App. Was nur das Labor hat, liegt hinter dem runden Knopf „Labor-Werkzeuge“ unten rechts über der Leiste
    (`LaborPanel`, `data-labor-button`): ein Blatt mit Stand, Absatz und Hinweis zur Ansicht, „Adresse in der App“
    (`data-address`), den Umschaltern der Ansicht (auf der Scheibe: Scheibe, Beispiel, Tippen, Neuer Schuss) und
    „Beispielscheiben öffnen“ bzw. „Zurück zur App“. Beispiele sind die Beispielscheiben in `CardView`, mit Adresse
    ohne Herkunft und ohne aktiven Bereich. Der Knopf steht zuletzt in der Ansicht (Tab-Folge), unter 1024 px über
    der Pille (`ReturnPill`), und zeigt ein Werkzeug, das bei geschlossenem Blatt weiterwirkt („Setzen“: Punkt und
    „Labor-Werkzeuge, Setzen aktiv“, `active`). Nach dem Wechsel App ↔ Beispiele steht der Fokus auf dem neuen Knopf.
  - **Darstellung** (System, Hell, Dunkel, `ThemeSwitch`): in Profil, am Desktop zusätzlich unten in der Seitenleiste (`AppFrame.sidebarFooter`, neben der Navigation). Die
    drei Knöpfe teilen sich dort die Breite.
  - Die Ansicht steht in `labor.mode`. Ein Anker der Zeitraum-Seite (`#history`, `#cards`, seit U1 auch `#numbers`)
    öffnet sie, ein Abend
    (`#2026-09-25`) die Scheiben-Liste.
  - **Router im Speicher:** Jeder Link (`RouteLink`) landet über den `RouteLinkProvider` in `go(route)` in `App`, wie
    ein Seitenwechsel: öffnen, Rückweg, Blättern, Querverweise, Navigation.
  - **Anker beim Laden** gilt nur für die erste Ansicht (`loadAnchor`; `leave()` ruft `leaveFirstView`): Danach trägt
    die Adresse noch den Anker der vorigen Seite (Sprungleiste, Reiter), und eine neue Seite beginnt oben (User, 9. Oktober 2026: „Beispielscheibe öffnen springt gleich zur Analyse“).
  - **Scrollstelle:** Jeder Bereich merkt sie sich mit seiner Adresse (ohne Wahl und Wertung). Wer zu derselben
    Adresse zurückkehrt, landet an derselben Stelle, sonst oben.
  - Eine Scheibe der Saison zeigt über `CardPage` die `CardContextBar` (Rückweg, vorige, nächste). Die Liste hat keine eigene Wertung: Sie nimmt die des Geräts (`scoring` im
    Speicher), die Scheibe und Zeitraum beim Umschalten schreiben. Die Familie teilen Liste und Zeitraum
    (`changeList`, `changePeriod` in `App`): wer sie in einem wählt, findet sie im anderen wieder, auch über die Leiste
    oben; Filter, Zeitraum und Scrollstelle bleiben je Ansicht. `App` hält, was beide teilen
    (Darstellung, Erklärungen, Blatt der Hilfe), den Zustand des Zeitraums (`periodReducer`) und die geöffnete
    Scheibe; `CardView` ist die Seite einer Scheibe, `PeriodView` die eines Zeitraums.
- **Adresse** (Plan N1, `nav/routes` und `nav/navigate` aus `shot-ui`): Das Blatt der Labor-Werkzeuge zeigt
  „Adresse in der App: …“
  (`data-address`) für den Zeitraum und die Scheibe. Im Artifact kommt nur ein einfacher Anker an, deshalb führt das
  Labor die Adresse nicht als URL. „Scheibe öffnen“ baut die Adresse der Scheibe mit dem Zeitraum als Herkunft, „Zurück
  zu „…““ stellt den Zeitraum aus ihr wieder her (`restore`), die Wertung der Scheibe kommt mit. Nur die Scrollstelle
  bleibt im Speicher. Die Prüfung rechnet jede gezeigte Adresse hin und zurück (`tools.nav`).
- **Saison** (`src/season.ts`): erfunden, Seed 20261009; Luftgewehr 81 Scheiben vom 6. April bis 27. September
  2026 (Formknick im Juni σ 1,9 mm, neue Munition ab 1. August σ 1,3 mm, Urlaub 3.–16. August, eine Scheibe
  `nur-pdf`, Trainings nur aus Probe), Luftpistole 46 (seit N2 fünf mehr aus eigenem Zufall: an zwei Abenden zwei
  Scheiben, drei Samstage mit Luftgewehr am selben Abend; seit N5 zwei am letzten Abend, einem Mischabend mit dem
  Wettkampf des Luftgewehrs; das Luftgewehr bleibt gleich, Fingerabdruck im Test); amtliche Wertung je Scheibe (Luftpistole und Wettkampf ganze Ringe, Training Luftgewehr Zehntel, nur
  Probe keine); benannt „Vorbereitung Landesmeisterschaft“ und „Neue
  Munition“; „jetzt“ ist der 30. September 2026, 12:00 Uhr MESZ (die Saison liegt ganz in der Sommerzeit).
- **Seite aus `CardPage`** (Plan Schritt 4): die Seite einer Scheibe wie in der App. Was nur das Labor hat (Scheibe,
  Beispiel, Ansehen/Setzen, Neuer Schuss, der Hinweis zum Beispiel), steht im Blatt der Labor-Werkzeuge; „Übrige
  blass/aus“ ist ein Eckknopf der Scheibe. Reiter: eine Scheibe beginnt mit dem ersten (User, 9. Oktober 2026), nur ein Anker beim Laden der Beispiele öffnet einen anderen; kein gemerkter Reiter. In der Prüfung schreibt
  das Labor keinen Anker, und `underTest()` hält `#pruefen` beim Laden fest. Seit U1
  (`plans/2026-10-09-spiegel-scheibe-entschlacken.md`) ohne Abschnitt „Zahlen“: Der Schalter „Erklärungen“ steht im
  Kopf der Analyse (`AnalysisPanel.action`), der Kopf der Scheibe zeigt die wichtigsten Beobachtungen
  (`keyObservations`, auf dem Telefon nur die erste) mit „Alle Beobachtungen ›“, das zur Karte „Beobachtungen“ im
  Überblick springt; die Prüfung vergleicht sie mit `tools.keyObservations`.
- **Prüfung der Seite:** Desktop in einem Rahmen von 1280 × 900 (das Fenster der Prüfung ist über 2000 px hoch),
  Telefon bei 390 und 375 px, Querformat 812 × 375. `scrollWhileStuck` scrollt in den Bereich, in dem die
  Scheibe klebt; Knöpfe nur mit Symbol (Ecken der Scheibe) findet `button` über ihren Namen. Headless-Chrome
  liefert hier keine Rückrufe eines `IntersectionObserver` und kein glattes Scrollen; Bausteine, die die
  Prüfung sehen soll, messen beim Scrollen und springen sofort.
- **Artifact neu veröffentlichen** aus `dist/labor.html` nach einem direkten `pnpm --filter @vereinsheim/labor
build` (ohne Turbo-Cache, sonst kann der Stand-Stempel von einem älteren Commit stammen), unter derselben
  Adresse, damit der User den
  Stand auf dem Handy sieht.
- **Beispiele** (`src/samples.ts`) mit festem Seed und festem Beginn, Lagen auf 1/100 mm; kein echter
  Ausdruck (ADR-029). Die Seeds sind die der Spielwiese, damit beide dasselbe zeigen. „Zwei Abreißer“
  (Luftgewehr, Oktober 2026) zeigt, dass sich zwei nahe Abreißer im schrittweisen Ausreißer-Test nicht verdecken.
- `build` läuft im Gate (esbuild und Tailwind über PostCSS, unter zwei Sekunden) und hängt an `^build`,
  damit eine Änderung an einem Baustein den Cache ungültig macht.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
