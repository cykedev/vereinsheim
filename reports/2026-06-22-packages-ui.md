# Validate-Report: Phase 4 / Zyklus 2 — `packages/ui`

> PIV-Schritt 3. Branch `feat/packages-ui` (4 Commits), Plan
> [plans/2026-06-22-packages-ui.md](../plans/2026-06-22-packages-ui.md). Verifiziert im Haupt-Tree
> (mit `.env` + Dev-Postgres), 22.06.2026. Alle Belege aus diesem Lauf.

## Ergebnis: **grün**

Die byte-identische UI-Schicht (17 `ui/*` + 4 `shell/*` + globals.css-Theme-Kern) ist echt nach
`@vereinsheim/ui` geteilt; ~232 Importe umgestellt, 42 App-Kopien gelöscht, `globals.css` auf einen
4-Zeilen-Stub reduziert, das Drift-Gate auf 5 triviale Reste geschrumpft.

## 1. Quality-Gates — `pnpm check` 17/17

```
Tasks:    17 successful, 17 total
treffsicher:test:   Test Files  58 passed (58)   Tests  306 passed (306)
ringwerk:test:      616 passed (aus Zyklus-1-Lauf bestätigt; hier gecacht)
```
lint, format:check, test (DB-Integration inkl. publicSlug), check-types, **next build** — alle grün
über beide Apps + `@vereinsheim/ui`. (Hinweis: `next build` muss **vor** `check-types` laufen, sonst
schlägt check-types am noch nicht generierten `.next/types/validator.ts` fehl — turbo-Race, kein Defekt.)

## 2. Tailwind `@source` (der Zyklus-2-Risikopunkt)

- **Host-Smoke bestätigt**: eine garantiert eindeutige Sentinel-Klasse (`mt-[12345px]`) NUR in
  `packages/ui/src` erschien nach `next build` im App-CSS → Tailwind scannt die Paket-Sourcen via
  `@source`. (Erster Versuch mit `bg-[oklch(… 0.333)]` war falsch-negativ — ungültiger Hue, nicht
  `@source`; Lektion: valide Sentinel-Klasse nutzen.) Gewählte Variante: **paket-relativ in
  `theme.css`** (`@source "./src"`) → App-`globals.css` bleibt ein 4-Zeilen-Stub.
- **Geprunter Kontext verifiziert**: `turbo prune ringwerk --docker` → „Added @vereinsheim/ui"; out/full
  enthält `packages/ui/theme.css` (mit `@source "./src"`), 17 ui-Komponenten und die workspace-dep. Der
  paket-relative `@source` bleibt im geprunten Layout gültig.
- **Voller Container-Build grün** (`docker buildx … --target runner --build-arg APP=ringwerk out`):
  Exit 0, Image `local/ringwerk:ui-validate` (306 MB). Das aus dem Image extrahierte CSS ist
  **byte-identisch** zum Host-Build (74 752 = 74 752 Bytes) → `@source` greift im geprunten
  Container-Kontext exakt wie auf dem Host (sonst fehlten die Paket-Komponenten-Klassen → kleineres CSS).
  Damit funktioniert der Deploy-Pfad mit der geteilten UI-Schicht.

## 3. Drift-Gate

`bash scripts/consistency-check.sh` → `RESULT: OK — keine Drift erkannt`. `MUST_MATCH` auf 5 Dateien
reduziert (components.json, globals.css-Stub, error.tsx, (app)/error.tsx, not-found.tsx — alle
byte-identisch); die ui-Diff-Schleife entfernt. Die app-spezifischen `ui/*` (chart/form/table,
checkbox/rank-badge/skeleton) dürfen bewusst abweichen.

## 4. Deps

`radix-ui` bleibt App-dep (ringwerk `checkbox`, treffsicher `form` nutzen es direkt — verifiziert);
`@radix-ui/react-slider`/`class-variance-authority`/`next-themes` nur noch im Paket; `lucide-react`
(53/29) + `sonner` (18/11) weiter App-deps; `tw-animate-css` bleibt (globals.css-`@import`).

## 5. Offen
- Browser-Smoke (gestyltes Rendering im Dark-Mode): der `@source`-Mechanismus ist via Sentinel +
  Container-Build belegt; ein visueller Browser-Check ist optional (bei Zyklus 1 host-ressourcenbedingt
  blockiert). Empfehlung: vor dem nächsten echten Release einmal nachholen.

## 6. Fazit
5 Gates grün, `@source` end-to-end belegt (Host-Smoke + geprunter Kontext + Container-Build), Drift-Gate
auf den Next/shadcn-Rest geschrumpft. → bereit für **`/review`**.
