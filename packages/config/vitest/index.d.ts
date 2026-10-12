// Selbst-enthaltene Typen (bewusst kein `import from "vitest"`), wie bei `next`:
// `next build` typprüft die vitest.config.ts der App mit, und so braucht das keine
// Auflösung von "vitest" aus dem Paket-Kontext. Das Ergebnis ist ein gültiger
// Teilausschnitt von Vitests `UserConfig` und geht so in `mergeConfig`.
export declare function createVitestConfig(appDir: string): {
  test: {
    environment: "node"
    maxWorkers: string
    exclude: string[]
  }
  resolve: {
    alias: Record<string, string>
  }
}
