// .env laden, damit die Tests der Zugriffe DATABASE_URL sehen (geteilter Dev-Postgres aus
// docker-compose.dev.yml, Datenbank "spiegel").
import "dotenv/config"
import { defineConfig, configDefaults } from "vitest/config"
import path from "path"

import { DEV_DATABASE_URL } from "./test/dev-database"

process.env.DATABASE_URL ??= DEV_DATABASE_URL

export default defineConfig({
  test: {
    environment: "node",
    // Drei App-Suites laufen via turbo parallel: Worker begrenzen, sonst überbucht die CPU.
    maxWorkers: "50%",
    // Die Tests der Zugriffe teilen sich eine Datenbank; jede Datei räumt ihre Anlage selbst auf.
    fileParallelism: false,
    exclude: [...configDefaults.exclude, "**/.next/**", ".claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test/server-only-stub.ts"),
    },
  },
})
