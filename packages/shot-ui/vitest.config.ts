import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    // kein gemeinsamer Modul-Cache, siehe packages/config/vitest/index.mjs
    fsModuleCache: false,
    passWithNoTests: true,
  },
})
