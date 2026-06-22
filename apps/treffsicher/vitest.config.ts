import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    // Tests laufen in Node.js-Umgebung (kein Browser), da wir reine Logik testen
    environment: "node",
    // Im Monorepo laufen beide App-Test-Suites via turbo parallel. Ohne Cap
    // startet jede ~cores Worker → Oversubscription → CPU-Starvation-Flakes.
    // 50% pro Suite → zwei Suites = etwa cores, kein Überbuchen.
    maxWorkers: "50%",
  },
  resolve: {
    // @-Alias muss hier wiederholt werden, da vitest tsconfig nicht automatisch liest
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
