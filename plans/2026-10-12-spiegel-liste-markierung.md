# Spiegel: markiert, wohin man in die Liste kommt

## Kontext

Der User am 12. Oktober 2026: „wenn man zu einer scheibe in scheiben navigiert (z.b. zeige abend in scheiben) dann weiss
man nicht welche das ist. es fehlt ein highlighting“. Heute springt die Liste zu einem Abend (`#2026-10-09` von Start,
„Abend in Scheiben ›“, oder vom Hinweis auf andere Familien), markiert ihn aber nicht. Der Rückweg von einer Scheibe
(„← Scheiben“) und „Alle in Scheiben zeigen“ aus dem Fortschritt führen an den Anfang der Liste, ohne die Scheibe zu
zeigen. [[spiegel-navigation]] sieht das Markieren schon vor (Entscheidung 12: „die neue Scheibe ist dort markiert“).
Der Fortschritt markiert seine Wahl mit `bg-accent-wash`.

## Entscheidungen

- **Der Abend aus dem Anker:** Seine Zeilen tragen `bg-accent-wash` und `data-marked`, wie die Wahl im Fortschritt.
  Der Sprung zum Anker bleibt beim Browser bzw. Router.
- **Eine Scheibe über `pick`:** `ListRoute.pick` (optional, Adresse `pick=<id>` wie im Fortschritt; „was man sieht“
  gehört in die Adresse).
  - Gesetzt wird es vom Rückweg aus einer Scheibe mit Herkunft Liste (`backRoute`) und von „Alle in Scheiben zeigen“
    mit einer Wahl (`listFromProgress`).
  - Die Zeile der Scheibe ist markiert (`aria-current="true"`), und die Liste scrollt sie in die Mitte.
  - Filter, „Im Fortschritt zeigen“, der Hinweis auf andere Familien und die Bereiche (`areaLinks`) lassen `pick` fallen.
- **App:** Den Abend liest die Hülle aus `location.hash`, denn der Server sieht den Anker nicht. Bis dahin gilt null,
  damit das gezeichnete HTML beim Hydrieren passt. `pick` kommt vom Server aus der Adresse.
- **Labor:** gibt Abend und `pick` seiner Route an die Liste weiter.

## Aufgaben

1. `nav/routes.ts`: `ListRoute.pick?` lesen und schreiben (nur gültige Ids). Tests: hin und zurück, ungültig, und dass
   ein Filter und `areaLinks` es fallen lassen.
2. `nav/navigate.ts`: `backRoute` (Liste mit `pick`), `listFromProgress` (mit der Wahl des Fortschritts); Tests.
3. `list/EveningList.tsx`: Props `evening` und `pick`; Zeilen des Abends und die gewählte markiert; Markup-Test.
4. App:
   - `ListScreen` liest den Abend aus dem Anker und `pick` aus der Abfrage, die Seite gibt `pick` weiter.
   - Beim Laden mit `pick` scrollt die Zeile in die Mitte.
5. Labor: `ListView` bekommt Abend und `pick` aus der Route von `App`.
6. Doku: [[spiegel-navigation]] und `packages/shot-ui/CLAUDE.md` (Liste).

## Dateien

- `packages/shot-ui/src/nav/{routes,navigate}.ts`, `src/list/EveningList.tsx` und ihre Tests
- `apps/spiegel/src/app/(app)/cards/page.tsx`, `src/components/list/ListScreen.tsx`
- `tools/labor/src/{App,ListView}.tsx`
- `vault/spiegel/spiegel-navigation.md`, `packages/shot-ui/CLAUDE.md`

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Scheiben-Liste, Zustand in der Adresse), [[spiegel-navigation]]

## Tests

- Routen: `pick` hin und zurück, ungültige Id fällt weg; `backRoute` aus der Liste trägt die Scheibe;
  `listFromProgress` trägt die Wahl; `listOnEvening` und `areaLinks` ohne.
- `EveningList`: die Zeilen des Abends und die gewählte Zeile markiert, sonst keine.

## Verifikation

- `pnpm check`, Labor `pruefen`.
- Browser mit den eigenen Scheiben:
  - Start „Abend in Scheiben ›“: Der Abend ist markiert und im Bild.
  - Eine Scheibe aus der Liste öffnen, „← Scheiben“: Die Zeile ist markiert und in der Mitte.
  - Fortschritt mit Wahl, dann „Alle in Scheiben zeigen“: Die Zeile ist markiert.
  - Ein Filter danach: keine Markierung mehr.
