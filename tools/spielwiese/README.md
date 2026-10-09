# Spielwiese

Klickbarer Prototyp für Spiegel auf dem echten Fachkern: Scheibe, Serien als kleine Scheiben,
Analyse in sechs Reitern, Hilfe aus `@vereinsheim/shot-help`, Ausdruck lesen mit
`@vereinsheim/meyton-pdf`. Veröffentlicht als privates Artifact
https://claude.ai/artifact/58GBLyEKGutSbKxyjfJ6K5 (Version 13, Stand `4c5b311`).

Seit Oktober 2026 entstehen die Bausteine als echte Komponenten in `packages/shot-ui` und werden im Labor
(`tools/labor`) erprobt. Bis ein Baustein dort ist, bleibt die Spielwiese die Referenz für Aussehen und
Verhalten; ihre Prüfungen werden Schritt für Schritt Prüfungen des Labors.

Die Vorlage bleibt wie Version 13, auch wo der Fachkern weiter ist: Seit Oktober 2026 rechnet die Form der
Gruppe ohne die Ausreißer, das Formdiagramm der Spielwiese zentriert aber auf alle Punkte. Nach einem neuen
Bau säße die Ellipse dort versetzt; das Labor zeigt es richtig. Ebenso liest die Vorlage `cons.mad`, das der
Fachkern seit dem 9. Oktober 2026 als `shotSd` liefert (Abweichung je Schuss als SD): Nach einem neuen Bau stünde
dort „NaN Ringe (MAD)“. Seit U4 (9. Oktober 2026, Scheibe wie am Ausdruck) fehlen dem Fachkern `sighterZeroed` und
`sighterComparison`: Der Reiter „Probe“ und die Skriptprüfung (`harness.js`) liefen nach einem neuen Bau ins Leere.

## Herkunft

Die Quellen lagen nur im Scratchpad einer Session und gingen am 8. Oktober 2026 beim Neustart
verloren. Gerettet:

- `template.html` aus der veröffentlichten Seite (Version 13): Bundles und Stand wieder durch die
  Platzhalter ersetzt; der Rückweg ergibt die Seite Byte für Byte.
- `harness.js` (Skriptprüfung, 118 Prüfungen) aus dem Sitzungsprotokoll: die erste Fassung und alle
  17 Änderungen nachgespielt, gegen vier Zwischenstände aus dem Protokoll abgeglichen, gegen
  Version 13 0 FAIL von 118.
- `entry*.ts`: die drei Bundles entstehen daraus Byte für Byte wie in Version 13.

## Bauen (bis es ein Skript gibt)

Aus der Wurzel des Repos, `E=node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild`:

```
$E tools/spielwiese/entry.ts --bundle --format=iife --global-name=ShotCore --minify --charset=utf8 --outfile=shotcore.js
$E tools/spielwiese/entry-help.ts --bundle --format=iife --global-name=ShotHelp --minify --charset=utf8 --outfile=shothelp.js
$E tools/spielwiese/entry-pdf.ts --bundle --format=iife --global-name=MeytonPdf --platform=browser --target=es2020 --minify --outfile=meytonpdf.js
```

Dann in `template.html` die Platzhalter `/*__SHOTCORE__*/`, `/*__MEYTONPDF__*/`, `/*__SHOTHELP__*/`
durch die Bundles ersetzen, `__COMMIT__` durch den Stand und `__TESTS__` durch die Zahl der Tests.
Für die Skriptprüfung die Seite in ein Gerüst (`<!doctype html>…<body>` … `</body></html>`) legen,
direkt nach `<body>` den Fehlersammler
`<script>window.__errors = []; addEventListener("error", (e) => window.__errors.push(String(e.message)))</script>`
und vor `</body></html>` `harness.js` einfügen, mit `#pruefen` in Headless-Chrome öffnen
(`--dump-dom`, `--virtual-time-budget=40000`) und `<pre id="dbg">` lesen.

## Daten

Die sechs Teiler und Werte des Beispiels „Ausdruck“ stehen auch in den Fixtures von `shot-core`.
Das eingebettete Beispiel-PDF ist erfunden („Beispiel, ohne Namen“); seine ID steht auch in den
Tests von `meyton-pdf`. Kein echter Ausdruck gehört hierher (ADR-029).
