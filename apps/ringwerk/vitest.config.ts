// .env laden, damit DB-Integrationstests (z.B. publicSlug) DATABASE_URL sehen.
// Im Monorepo laufen Tests auf dem Host (nicht im Docker-Container) → der geteilte
// Dev-Postgres aus docker-compose.dev.yml.
import "dotenv/config"
import { defineConfig, mergeConfig } from "vitest/config"
import { createVitestConfig } from "@vereinsheim/config/vitest"

export default mergeConfig(
  createVitestConfig(__dirname),
  defineConfig({
    test: {
      // Kein Fehler wenn noch keine Testdateien vorhanden sind (frühe Projektphasen)
      passWithNoTests: true,
    },
  })
)
