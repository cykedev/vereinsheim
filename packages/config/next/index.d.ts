// Selbst-enthaltene Typen (bewusst kein `import from "next"`): so braucht die
// Typprüfung der App keine Cross-Package-Auflösung von "next" aus dem
// Paket-Kontext (relevant im geprunten Docker-Build, wo `next build` die
// next.config.ts mit-typprüft). Die App weist das Ergebnis ohnehin `NextConfig`
// zu — die Struktur unten ist ein gültiger Teilausschnitt davon.
export declare function createNextConfig(appDir: string): {
  output: "standalone"
  outputFileTracingRoot: string
  experimental: {
    serverActions: {
      // Literal (nicht `string`) — muss zu Next's `SizeLimit` (Template-Literal
      // `${number}mb`) zuweisbar bleiben; in Sync mit dem Wert in index.mjs halten.
      bodySizeLimit: "12mb"
    }
  }
}
