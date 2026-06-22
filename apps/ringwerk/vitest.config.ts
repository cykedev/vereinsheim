// .env laden, damit DB-Integrationstests (z.B. publicSlug) DATABASE_URL sehen.
// Im Monorepo laufen Tests auf dem Host (statt im Docker-Container, der die Env
// früher gesetzt hat) → der geteilte Dev-Postgres aus docker-compose.dev.yml.
import "dotenv/config"
import { defineConfig, configDefaults } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    // Tests laufen in Node.js-Umgebung (kein Browser), da wir reine Logik testen
    environment: "node",
    // Im Monorepo laufen beide App-Test-Suites via turbo parallel. Ohne Cap
    // startet jede ~cores Worker → Oversubscription → CPU-Starvation-Flakes.
    // 50% pro Suite → zwei Suites = etwa cores, kein Überbuchen.
    maxWorkers: "50%",
    // Kein Fehler wenn noch keine Testdateien vorhanden sind (frühe Projektphasen)
    passWithNoTests: true,
    // Build-Output ausschliessen: next build (output:"standalone") kopiert src
    // inkl. *.test.ts nach .next/standalone → vitest würde diese Duplikate laden
    // und am Modul-Resolve scheitern. Plus Worktrees. configDefaults behält die
    // vitest-Defaults (node_modules/dist/…).
    exclude: [...configDefaults.exclude, "**/.next/**", ".claude/worktrees/**"],
  },
  resolve: {
    // @-Alias muss hier wiederholt werden, da vitest tsconfig nicht automatisch liest
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
