# @vereinsheim/pruefen — Claude Scope-Notiz

Werkzeug für die Skriptprüfung der Apps im Browser (`pnpm --filter <app> pruefen`): Chrome headless über das
DevTools-Protokoll, der eigene Build einer App als Server, Prüfungen, die jede App mit Design 2 braucht, und Text und
Bilder von PDFs. Nicht im Gate (braucht Chrome, einen laufenden Server und Daten); die reinen Teile haben Tests.

## Exporte

| Export                         | Datei            | Inhalt                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vereinsheim/pruefen/browser` | `src/browser.ts` | `Browser`, `Page` (echte Eingaben, Helfer im Fenster wie `$`, `button`, `widest`; Foto eines Elements `screenshotOf`, Cookies `cookieHeader`, Tippen `type`, Dateien in ein Feld `setFiles`, Browser-Dialoge in `dialogs`; `goto` mit `settle`; `newPage({ isolated: true })` ohne Cookies) |
| `@vereinsheim/pruefen/server`  | `src/server.ts`  | `startServer({ app, port, secret?, hostname? })` startet `.next` der App, `appDir(app)`                                                                                                                                                                                                     |
| `@vereinsheim/pruefen/common`  | `src/common.ts`  | `noSideScroll` (mit `minFieldPx` dazu Felder ab dieser Schrift unter 768 px), `barDoesNotCover`, `themeNoFlash`, `dialogFocus`, `noHiddenCopy` (Tab im Hintergrund), `pageText`; je `Check`                                                                                                 |
| `@vereinsheim/pruefen/pdf`     | `src/pdf.ts`     | `pdfText` (`pdftotext -layout`), `pdfPages` (`pdftoppm -png -r 100`), `pdfTextAndPages` (beides, ohne zu blockieren)                                                                                                                                                                        |
| `@vereinsheim/pruefen/measure` | `src/measure.ts` | `measurePage` (Länge in Bildschirmen, Bedienelemente und Zahlen gesamt und im ersten Bildschirm, mehrfache Werte, Fachbegriffe), `measureTable` für die Durchsicht nach drei Ebenen                                                                                                         |

## Regeln

- **Ohne Abhängigkeit:** Node bringt `WebSocket` und `fetch`; Chrome kommt vom System (`CHROME_PATH`), Poppler
  ebenso. Fehlt Poppler, sagt `pdf.ts` in einem Satz, wie es zu installieren ist.
- **Ergebnisse statt Bericht:** Die Prüfungen liefern `Check { name, ok, detail }`; Bericht, Abschnitte und Konto
  bleiben in der App (`tools/pruefen.ts`).
- **Nur Struktur:** Die Helfer im Fenster suchen nach Daten-Attributen und ARIA, die `ui`, `shot-ui` und die Apps
  rendern (`data-app-frame`, `data-app-bar`, `data-app-content`, Rollen der Dialoge), nie nach Texten einer App.
- Gegen einen fremden Server nur mit ausdrücklichem Schalter der App; `startServer` verweigert einen belegten Port.
- **Browser-Dialoge** (`beforeunload`, `alert`, `confirm`) nimmt `Page` an, sonst hielte der Dialog jede Navigation an;
  sie stehen in `page.dialogs`. Eine App-Prüfung meldet jeden, den sie nicht erwartet.
- **Fotos über das Fenster hinaus** (`screenshot(true)`, `screenshotOf`) vergrößern das emulierte Fenster, höchstens auf
  16.000 px (`MAX_SHOT_HEIGHT`), und fotografieren dann normal. Nie `captureBeyondViewport` und nie
  `Page.getLayoutMetrics`: Beides beendet Chrome 155 headless („Chrome ist weg“). Längere Seiten enden im Foto dort.
