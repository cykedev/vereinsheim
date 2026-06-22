# @vereinsheim/ui — Claude Scope-Notiz

Geteilte **UI-Schicht** (shadcn-Primitives + App-Shell + Theme) für beide Apps (Phase 4 / Zyklus 2,
ADR-015/016). Ersetzt die früher byte-identischen Kopien in `apps/*/src/components/{ui,app/shell}` + den
globals.css-Theme-Kern — Drift damit **strukturell unmöglich**.

## Was hier liegt

| Export                         | Inhalt                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `@vereinsheim/ui/<name>`       | `src/ui/<name>.tsx` — 17 shadcn-Primitives (button, card, dialog, …)                                     |
| `@vereinsheim/ui/shell/<name>` | `src/shell/<name>.tsx` — ConfirmDialog, DetailActionBar, PageHeader, Providers                           |
| `@vereinsheim/ui/theme.css`    | `theme.css` — Tailwind-Theme-Kern (@custom-variant, @theme, :root, .dark, @layer) + `@source` aufs Paket |

## Regeln

- **Just-in-time-Paket**: TS-Source direkt; Next transpiliert via `transpilePackages` (in
  `@vereinsheim/config/next`). `"use client"` bleibt in den interaktiven Komponenten.
- **`react`/`react-dom`/`next`/`next-auth` sind peerDependencies** (App liefert sie → eine Instanz).
  `radix-ui`/`@radix-ui/react-slider`/`class-variance-authority`/`next-themes` sind Paket-deps;
  `lucide-react`/`sonner` zusätzlich App-deps (App-Code nutzt sie auch). `cn` kommt aus `@vereinsheim/lib`.
- **Tailwind `@source`**: `theme.css` nimmt die Paket-Sourcen ins Class-Scanning — sonst fehlen die
  Klassen der Paket-Komponenten im App-Build (Tailwind v4 scannt sonst nur den App-Baum).
- **Kein `"use server"`**; **shadcn-CLI** läuft weiter im App-Kontext (`components.json` + der
  `globals.css`-Stub bleiben app-lokal).
- Cross-Importe paket-intern **relativ** (`./button`, `../ui/alert-dialog`) — nicht über `@vereinsheim/ui`.
- Verhalten/Styles ändert man **hier**, nicht in den Apps. Nach Änderungen: `pnpm check` grün.
