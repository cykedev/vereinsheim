# Aufräumen: Labor und Spielwiese entfernen, Bedienung an der App prüfen

## Kontext

Wunsch des Users (12. und 13. Oktober 2026, [[spiegel-roadmap]] „Offene Einzelpunkte“, „Aufräumen“): Labor
(`tools/labor`), Spielwiese (`tools/spielwiese`) und was nur für sie da ist, werden nicht mehr gebraucht, seit die App
selbst läuft; sie sind schon nicht mehr deckungsgleich mit ihr (Fortschritt und Liste haben in der App den
`ScoringChip`, Profil hat keine Wertung, Start kein „Offen“). Vor dem Push soll aufgeräumt sein.

Vorher geprüft (Inventur der Skriptprüfung `tools/labor/pruefung.js`, 322 Prüfungen in 53 Gruppen):

- **62 % sind schon durch Tests abgedeckt** (Zahlen, Texte, Attribute, Reihenfolge, Adressen in `shot-ui`,
  `shot-core`, `apps/spiegel/src/lib`); das Labor rechnete sie über seinen Prüfhaken nur nach.
- **8 % prüfen das Labor selbst** (Blatt der Labor-Werkzeuge, „Setzen“, Beispielscheiben, Wertung des Geräts).
- **28 % brauchen einen echten Browser** (Klicks, Fokus, `<dialog>`, Kleben und Springen, Geometrie bei sieben
  Fenstergrößen, Anker, Scrollstelle), fast alles ist in der App erreichbar.
- **2 % lassen sich als Markup-Test** (`renderToStaticMarkup`) prüfen.
- `apps/spiegel` hängt am Labor: `seed:own` liest die eigenen Scheiben des Users aus `@vereinsheim/labor/own-cards`
  (das klärt nebenbei den offenen Punkt aus SP-1.9: `turbo prune spiegel` nähme das Labor sonst mit ins Image).

## Entscheidungen

- **D1 Die eigenen Scheiben ziehen in die App** (`apps/spiegel/tools/own-cards-data.ts`, unverändert, weiter nur für
  `seed:own`). Die Prüfungen aus dem Test des Labors, die an ihnen hängen (Ausdruck vom 2. Oktober als Anker, Pausen
  an der LP 60 vom 12. Juni, verdeckt auch bei Anzeigeart 10), wandern nach `apps/spiegel/tools/own-cards.test.ts`.
- **D2 Skriptprüfung der App** statt der des Labors: `pnpm --filter spiegel pruefen` gegen die laufende App
  (`BASE_URL`, Vorgabe `http://localhost:3002`, Daten aus `seed:own --demo`, angemeldet mit dem Demo-Konto). Chrome
  headless über das DevTools-Protokoll mit dem `WebSocket` von Node 24, **ohne neue Abhängigkeit**. Anders als im
  Labor sind Klicks, Zeiger und Tasten **echte Eingaben** (`Input.dispatch*`): Fokus, Standardaktionen und `next/link`
  verhalten sich wie beim Menschen, die Umwege der synthetischen Klicks entfallen. Nicht im Gate (braucht Chrome, einen
  laufenden Server und Daten), wie bisher `pruefen` des Labors.
- **D3 Umfang der Prüfung** (Stufe 1 der Inventur; Gründe dort): Rücksprung mit Pille, „Alle Beobachtungen“, Blatt
  der Hilfe, Lineal mit Zeiger und Tastatur, Seitenaufbau am Desktop, Platz für die Scheibe bei vier Fenstergrößen,
  kein seitliches Scrollen am Telefon, Anker beim Laden, Blättern, Scrollstelle beim Zurückkehren, „zeigen“ an einem
  Rekord, Blatt „Filter“, keine Skriptfehler. Ohne feste Zahlen: Die App zeigt echte Daten; geprüft werden Struktur,
  Geometrie und Gleichheiten.
- **D4 Markup-Tests** in `shot-ui`: keine Fachbegriffe auf den ersten beiden Ebenen in den gerenderten Seiten
  (`jargon.test.tsx`, Regex aus der Prüfung des Labors), und jedes Hilfe-Thema des Fortschritts hat einen Platz
  (wie `analysis/tabs/coverage.test.ts` für die Scheibe).
- **D5 Spielwiese ganz weg.** Ihre Vorlage ist seit Monaten eingefroren und weicht vom Fachkern ab (eigene README).
  Kommentare, die auf ihre Dateien zeigen, nennen sie als Prototyp; alte Pläne bleiben als Geschichte unverändert.
- **D6 Vault:** Die Incidents nur zum Labor (`labor-build-and-check-gotchas`, `data-url-preview-blocks-anchors`) bekommen
  den Status „erledigt, Labor entfernt“ statt gelöscht zu werden (Geschichte); Architekturkarte, [[conventions]] §10,
  `CLAUDE.md`-Dateien und Notes, die das Labor als heutigen Ort nennen, ziehen nach.
- **D7 Was bleibt:** `tools/ssmdb2-erkunden` (Erkundung am Stand, offene Punkte aus SP-0.1/0.6), `meyton-pdf` (für
  SP-1.7), `start/OpenBox` (für „Offen“ in SP-1.7). Exporte von `shot-ui`, die nur paketintern genutzt werden, bleiben
  (harmlos, und ein Umbau der Exporte gehört nicht in diesen Schritt).

## Aufgaben

1. Eigene Scheiben in die App, Tests übernehmen, Abhängigkeit `@vereinsheim/labor` raus (D1).
2. Spielwiese löschen, Kommentare mit Pfaden (D5).
3. Skriptprüfung der App: Läufer (Chrome, DevTools-Protokoll, Anmeldung, Fenstergrößen, echte Eingaben), Prüfungen nach
   D3, Befehl `pruefen`, Abschnitt in `apps/spiegel/CLAUDE.md`. Gegen die App laufen lassen, bis 0 FAIL.
4. Markup-Tests nach D4.
5. Labor löschen: `tools/labor`, `pnpm-workspace.yaml`, `.claude/launch.json`, Lockfile (`pnpm install`), Kommentare in
   `shot-ui` und App, die das Labor als Ort nennen.
6. Doku (D6): Architekturkarte, [[conventions]] §10, `packages/shot-ui/CLAUDE.md`, `apps/spiegel/CLAUDE.md`, Roadmap
   (Punkt „Aufräumen“ erledigt, SP-1.9 „vorher klären“ erledigt, SP-1.8 Abnahme ohne Labor), Notes mit dem Labor als
   heutigem Ort, Incidents.
7. Lokale Reste melden statt löschen: `tools/labor/dist`, `node_modules` unter `tools/labor` (gitignored) und der
   schon gemergte Zweig `feat/spiegel-kreise-tonung`.

## Prüfung

- `pnpm check` grün (ohne das Labor im Gate), `pnpm install --frozen-lockfile` sauber.
- `pnpm --filter spiegel pruefen` gegen die App mit `seed:own --demo`: 0 FAIL; Gegenprobe: eine Regel testweise brechen
  (etwa die Pille nicht zurückspringen lassen) → die Prüfung wird rot.
- `git grep` nach `tools/labor`, `@vereinsheim/labor`, `tools/spielwiese` außerhalb von `plans/`: nichts mehr.
