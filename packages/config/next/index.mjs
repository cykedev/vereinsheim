import path from "path"

const SERVER_ACTIONS_BODY_SIZE_LIMIT = "12mb"

/**
 * Geteilte Next-Config-Factory. Die App übergibt ihr eigenes Verzeichnis
 * (__dirname) → outputFileTracingRoot zeigt robust auf die Monorepo-Wurzel,
 * unabhängig davon, wo dieses Paket im Baum liegt. Host und geprunter
 * Docker-Kontext verhalten sich identisch: apps/<app> liegt zwei Ebenen unter
 * der Wurzel, daher join(appDir, "../../").
 */
export function createNextConfig(appDir) {
  return {
    // Standalone-Output bündelt alle Abhängigkeiten für minimale Docker-Images
    // Ermöglicht `node server.js` statt `npm start` im Container
    output: "standalone",
    // Monorepo: Datei-Tracing-Wurzel ist das Repo-Root (zwei Ebenen über
    // apps/<app>), sonst tract Next den Workspace falsch (NFT-Warnung beim Build).
    outputFileTracingRoot: path.join(appDir, "../../"),
    experimental: {
      serverActions: {
        // Upload-Limit ist 10 MB; hier mit etwas Puffer für Multipart/FormData-Overhead.
        bodySizeLimit: SERVER_ACTIONS_BODY_SIZE_LIMIT,
      },
    },
  }
}
