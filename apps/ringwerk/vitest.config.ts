import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    // Tests laufen in Node.js-Umgebung (kein Browser), da wir reine Logik testen
    environment: "node",
    // Kein Fehler wenn noch keine Testdateien vorhanden sind (frühe Projektphasen)
    passWithNoTests: true,
    // Worktrees im .claude-Verzeichnis ausschliessen (werden sonst doppelt gepickt)
    exclude: [".claude/worktrees/**", "**/node_modules/**"],
  },
  resolve: {
    // @-Alias muss hier wiederholt werden, da vitest tsconfig nicht automatisch liest
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
