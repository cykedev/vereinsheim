# Lessons — Spiegel

Kurzzeit-Gedächtnis (die letzten Einträge); Regeln stehen nach `/consolidate-lessons` in `vault/conventions.md`, die
Geschichte in `vault/incidents/`.

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
