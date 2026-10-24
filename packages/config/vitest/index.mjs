import path from "path"
import { fileURLToPath } from "url"
import { configDefaults } from "vitest/config"

/**
 * Geteilte Vitest-Grundkonfiguration. Die App übergibt ihr eigenes Verzeichnis
 * (__dirname) für den Alias `@` und ergänzt ihre Eigenheiten per `mergeConfig`.
 */
export function createVitestConfig(appDir) {
  return {
    test: {
      // Tests laufen in Node.js-Umgebung (kein Browser), da wir reine Logik testen
      environment: "node",
      // Die App-Suites laufen via turbo parallel. Ohne Cap startet jede ~cores
      // Worker → Oversubscription → CPU-Starvation-Flakes.
      maxWorkers: "50%",
      // Kein Modul-Cache auf der Platte: Vitest legt ihn für alle Pakete gemeinsam unter node_modules/.vitest-cache an
      // und leert ihn nach jeder Änderung am Lockfile. Die Suites laufen via turbo parallel und räumten dann
      // gleichzeitig auf (ENOTEMPTY beim Start).
      fsModuleCache: false,
      // Build-Output ausschliessen: next build (output:"standalone") kopiert src
      // inkl. *.test.ts nach .next/standalone → vitest würde diese Duplikate laden
      // und am Modul-Resolve scheitern. Plus Worktrees. configDefaults behält die
      // vitest-Defaults (node_modules/.git).
      exclude: [...configDefaults.exclude, "**/.next/**", ".claude/worktrees/**"],
    },
    resolve: {
      // @-Alias muss hier wiederholt werden, da vitest tsconfig nicht automatisch liest
      alias: {
        "@": path.resolve(appDir, "./src"),
        // `server-only` wirft ausserhalb der react-server-Condition beim Import.
        // Server-Module (z.B. @vereinsheim/lib/dateTime) sollen trotzdem testbar
        // sein → im Runner auf einen leeren Stub zeigen.
        "server-only": fileURLToPath(new URL("./server-only-stub.mjs", import.meta.url)),
      },
    },
  }
}
