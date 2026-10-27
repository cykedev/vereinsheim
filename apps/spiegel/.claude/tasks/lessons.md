# Lessons — Spiegel

Kurzzeit-Gedächtnis (die letzten Einträge); Regeln stehen nach `/consolidate-lessons` in `vault/conventions.md`, die
Geschichte in `vault/incidents/`.

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
