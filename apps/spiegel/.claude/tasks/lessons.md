# Lessons — Spiegel

Kurzzeit-Gedächtnis (die letzten Einträge); Regeln stehen nach `/consolidate-lessons` in `vault/conventions.md`, die
Geschichte in `vault/incidents/`.

## 2026-10-27 · Gegenprobe Ausdruck gegen Rohdaten (1c-0)

- **Summen gleich, Einzelwerte nicht: erst die Reihenfolge prüfen.** Der erste Lauf zeigte 82 % gleiche Werte je Schuss
  bei 100 % gleichen Serien-Summen. Ursache war keine Abweichung von Meyton, sondern der Leser: Ghostscript setzt den
  ersten Wert einer Zeile um Bruchteile eines Punkts tiefer, und das Sortieren nach y vor x schob ihn ans Zeilenende.
  Jetzt Zeile für Zeile (`readingOrder`), mit Test. → ARCHIVE (im Code gelöst); als Muster → DOCUMENT (conventions §9)
- **Ein Test kann eine Grenze verfehlen, weil die Fixture in Lesefolge steht:** Die Mutation „Serien-Block ohne untere
  Grenze“ blieb grün, weil `find` die Zeile der ersten Serie zuerst traf. Erst mit Serie 2 vor Serie 1 im Strom wurde sie
  rot. Fixtures für Leser von Positionen absichtlich aus der Lesefolge bringen. → DOCUMENT (conventions §9)
- **Werte aus echten Ausdrucken rutschen in Fixtures:** Beim Erkunden gesehene Zahlen („766T“ eines Ausdrucks ohne Namen)
  standen danach im Test und im Vault, bis die Review sie fand. Fixtures erfinden, nie aus der Erkundung abschreiben,
  auch keine einzelnen Zahlen. → REMEMBER (ADR-029 gilt schon)
- **Der übernommene Plan trug die E-Mail des Kontos:** `git show <basis>:plans/…` übernimmt den Plan wörtlich, samt
  Personendaten; ein späteres Löschen lässt sie in der History. Den Plan vor dem ersten Commit auf Namen, E-Mails und
  Nummern prüfen. → DOCUMENT (Skill `coordinate`, an die koordinierende Session gemeldet)
- **Wenige Paare trotz vieler Ausdrucke:** 63 eigene IDs, aber nur 12 mit Scheibe in der Dev-Datenbank, und die
  SSMDB2-Kopie hatte keine weiteren: Die Ablage behält ältere Scheiben nicht. Für Gegenproben am Ausdruck zuerst zählen,
  wie viele Paare es gibt. → ARCHIVE (Zahl im Vault, [[meyton-printout]])

## 2026-10-27 · Scheibe holen (1b-2)

- **In der Prod-Kopie ist die erste Anlage die echte:** „Scheibe holen“ arbeitet an `requestSiteId` (erste Anlage), die
  Demo-Scheiben liegen an der „Dev-Anlage“. Eine Demo-Sperre an der Dev-Anlage sah `fetchCard` nie, und die Vorbelegung
  der Disziplin fehlt dem Demo-Konto. Demo-Daten fürs Holen an `requestSiteId`, die Skriptprüfung prüft die Vorbelegung
  nur, wenn es eine gibt. → DOCUMENT (`apps/spiegel/CLAUDE.md`)
- **`next start` braucht `UPLOAD_DIR`:** Die Dev-`.env` hat es nicht (der Dev-Server nimmt `./uploads`), der
  Produktions-Server der Skriptprüfung warf beim ersten Ausdruck „Die Scheibe ließ sich nicht holen.“ Gefunden über den
  Fehlertext der Seite, nicht im Log. `pruefen --start` gibt dem Server jetzt ein Verzeichnis nur für den Lauf. →
  ENFORCE (`tools/pruefen.ts`)
- **Gebaute Stapel über 15 Minuten enden mit `past`:** Ein Test verschob die Beobachtung der Wertung um 20 Minuten, die
  Probe kam als `past` und es gab nur einen Block. Statt der Beobachtung die Zeiten der Probe zurückschieben und `nowMs`
  nahe der ersten Beobachtung setzen. → DOCUMENT (`apps/spiegel/CLAUDE.md`)
- **`pnpm add` löste fremde Peer-Varianten neu auf** (`eslint-plugin-import` in den Snapshots, alle Apps betroffen),
  auch mit `--lockfile-only`. Nur die Einfügungen übernommen, `--frozen-lockfile` grün. → DOCUMENT (conventions §9)
- **Die Vorschau startet `next dev` mit dem nvm-Default (Node 20):** Darunter liefert der Leser im Kindprozess nichts,
  Link, Upload und Kamera endeten im Dev-Server mit „Spiegel kann dieses PDF nicht lesen.“, während die Skriptprüfung
  gegen den Build unter Node 26 grün war. Den Dev-Server für Ausdrucke unter Node 26 starten, bis der Default 26 ist. →
  REMEMBER (Auto-Memory, maschinenlokal)
- **Ein Grund gehört an eine Stelle:** Nach der Durchsicht wollte der User den Grund ohne Werte nur in der Ergebnis-Box,
  an den übrigen Stellen des Gerüsts kurze Sätze („Noch keine Serien.“); ebenso aktive Knöpfe mit Feldfehler statt
  gesperrter und ein Knopf für Kamera und Foto. → DOCUMENT (`spiegel-ui-design`, `spiegel-navigation`)
- **Spiegel hatte keinen `Toaster`:** Die Konvention verlangt Toasts nach Aktionen, Spiegel nutzte bisher nur den
  Hinweis „Rückgängig“. Jetzt im Root-Layout wie in Treffsicher und Ringwerk. → ARCHIVE (im Code gelöst)

## 2026-10-27 · Ansichten jeder Detailtiefe (1a-2)

- **Neue Felder im Modell ändern die Charakterisierung:** `period/season.test.ts` schreibt jedes Feld von
  `PeriodModel` fest. Mit `basis`, `reasons` und `recordProvenance` wurde der Schnappschuss rot, obwohl keine Zahl sich
  änderte. Vor `vitest -u` mit einem kleinen Skript die alten Zeilen gegen die neuen halten: nur neue Felder, alte
  Werte gleich (beim Umbenennen einer Kennung nur die Reihenfolge nach Kennung). → DOCUMENT (conventions §9)
- **Ein FAIL der Skriptprüfung nach neuen Demo-Daten:** „Reiter Lage: … die Seite bleibt stehen“ fiel erst, als die
  Demo-Scheiben jeder Detailtiefe dazukamen (ein neuer Punkt in der Zeitreihe änderte, welche Scheibe die Prüfung
  wählt). Mit dem Build von `main` gegen dieselben Daten derselbe FAIL: kein Fehler dieses Branches, sondern ein
  Sprung der Seite um gut 20 px, wenn die gewählte Scheibe außerhalb der ersten zehn Zeilen der Liste liegt. →
  REMEMBER (incident `pruefen-reiter-lage-scroll-jump`)
- **Erfundene Scheiben aus `generateSeason` haben eine zufällige Form:** Ein Seed mit einer Scheibe liefert 30, 40
  oder keine Wertungsschüsse. Wer eine bestimmte Schusszahl braucht, nimmt die erste passende aus mehreren
  (`demoEnteredSeeds`). → ARCHIVE (im Code gelöst)
- **`NOT` über eine Spalte, die NULL sein kann, lässt diese Zeilen aus:** `deleteMany({ where: { NOT: [{ importKey: … }] } })`
  löschte keine Scheibe mit `importKey` NULL, denn in SQL ist `NOT (NULL = x)` NULL, nicht wahr. Aufgefallen beim
  Aufräumen der Demo-Scheiben, weil „entfernt 0“ blieb. → DOCUMENT (conventions §9)
- **Ein `<title>` im SVG steht im Textinhalt:** `MpiMark` trägt `<title>Schwerpunkt</title>`. Die Zeile daneben las
  `textContent` als „Schwerpunktnur die Mitte …“, die Skriptprüfung verglich auf Gleichheit. Sichtbar ist der Titel
  nicht. Ein Zeichen, das nur schmückt, bekommt keinen Titel (`MpiMark decorative`), dann liest der Screenreader nur den
  Satz und die Prüfung vergleicht ihn ganz. → ARCHIVE (im Code gelöst)

## 2026-10-27 · Werte und Lagen vom Ausdruck (1c)

- **pdf.js gibt beim Bauen der Operatoren die Ereignisschleife nicht ab:** Bei einer präparierten Zeichnung (zwei
  Millionen Linien) lief `getOperatorList` 6 s am Stück, ein Zeitgeber kam erst danach dran; `checkTime` zwischen den
  Schritten und ein `Promise.race` mit Zeitgeber helfen nicht. Gemessen mit einem `setInterval`, dessen Ticks nach
  0,8 s aufhörten. Was zur Grenze gelten soll (ID und Druckzeit), schreibt der Kindprozess deshalb vor dem riskanten
  Schritt als eigene Zeile; die App behält es, wenn sie ihn danach beendet. → ARCHIVE (im Code gelöst, `protocol.ts`)
- **Ein Test mit Stub gegen die Dev-Datenbank darf nur eigene Zeilen anfassen:** `rereadOutdatedPrintouts` liest alle
  veralteten Ausdrucke; im Test mit einem Stub als Leser hätte er die echten Ausdrucke der Prod-Kopie mit erfundenen
  Werten überschrieben. Jede Funktion, die über alle Zeilen läuft, bekommt für Tests eine Grenze auf die eigene Anlage
  (`siteId`). → DOCUMENT (conventions §9)
- **`vitest` prüft keine Typen, `tsc -p .` schon:** Ein Test las `shot.firedAtMs` statt `firedAt`; `undefined !== null`
  war wahr und der Test grün, erst `next build` im Gate fiel. Vor dem Commit läuft das Gate, nicht nur die Tests der
  Datei. → ARCHIVE (Gate deckt es)
- **Ein Dev-Server aus dem Haupt-Checkout belegt :3002:** Die Vorschau `spiegel` hat einen festen Port; im Worktree
  lief der eigene Server deshalb über `next dev --port 3022`. Dabei schreibt Next ein `AGENTS.md` in `apps/spiegel`
  (untracked), das am Ende wieder weg muss. → REMEMBER (Auto-Memory, maschinenlokal)

## 2026-10-28 · Ziele und Abläufe im Tagebuch (2b)

- **Ein Wert aus einer Abfrage-Datei zieht die Datenbank in den Browser:** `RoutineScreen` und `RoutineForm` (Client)
  holten die Konstante `NO_FAMILY` aus `src/diary/queries.ts`. `tsc`, Lint und Tests waren grün, erst `next build` fiel
  mit „does not support external modules (request: node:module)“. Client-Komponenten holen aus Abfrage-Dateien nur
  Typen; geteilte Werte stehen in Dateien ohne Datenbank (`src/diary/paths.ts`, `components/styles.ts`). → DOCUMENT
  (`apps/spiegel/CLAUDE.md`, Tagebuch)
- **Gate und Commit mit `&&`, nie mit `;`:** Eine Kette mit `;` hat den Commit trotz rotem `next build` gemacht; er
  wurde danach mit grünem Gate nachgebessert. → REMEMBER (Auto-Memory „Gate before commit“ besteht schon)
- **Die Projektion steht in festen Spalten:** Ein neues Feld an `CardProjection` (Fachkern) kommt erst in der Datenbank
  an, wenn `CardProjection` eine Spalte dafür hat und `saveProjection` sie schreibt; der Test „Version und Ausgabe“ im
  Fachkern sieht das nicht. Die Übersichten lesen die Spalte nicht (`OVERVIEW_SELECT`), nur wer sie braucht
  (`seriesOfCards`). → DOCUMENT (`vault/spiegel/spiegel-metrics.md`)
- **`seed:own` nach `seed:own --demo` braucht `--email`, wenn `SEED_ADMIN_EMAIL` ein Konto nennt, das es in der
  Prod-Kopie nicht gibt:** Sonst bleiben die eigenen Scheiben beim Demo-Konto (am 28. Oktober 2026 rund 20 Minuten, 90
  statt 122 Scheiben). → REMEMBER (Auto-Memory)
