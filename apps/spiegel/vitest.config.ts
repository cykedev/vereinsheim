// .env laden, damit die Tests der Zugriffe DATABASE_URL sehen (geteilter Dev-Postgres aus
// docker-compose.dev.yml, Datenbank "spiegel").
import "dotenv/config"
import { defineConfig, mergeConfig } from "vitest/config"
import { createVitestConfig } from "@vereinsheim/config/vitest"

import { DEV_DATABASE_URL } from "./test/dev-database"

process.env.DATABASE_URL ??= DEV_DATABASE_URL

export default mergeConfig(
  createVitestConfig(__dirname),
  defineConfig({
    test: {
      // Die Tests der Zugriffe teilen sich eine Datenbank; jede Datei räumt ihre Anlage selbst auf.
      fileParallelism: false,
    },
  })
)
