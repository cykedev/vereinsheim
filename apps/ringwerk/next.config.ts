import type { NextConfig } from "next"
import path from "path"

const SERVER_ACTIONS_BODY_SIZE_LIMIT = "12mb"

const nextConfig: NextConfig = {
  // Standalone-Output bündelt alle Abhängigkeiten für minimale Docker-Images
  // Ermöglicht `node server.js` statt `npm start` im Container
  output: "standalone",
  // Monorepo: Datei-Tracing-Wurzel ist das Repo-Root (zwei Ebenen über
  // apps/<app>), sonst tract Next den Workspace falsch (NFT-Warnung beim Build).
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    serverActions: {
      // Upload-Limit ist 10 MB; hier mit etwas Puffer für Multipart/FormData-Overhead.
      bodySizeLimit: SERVER_ACTIONS_BODY_SIZE_LIMIT,
    },
  },
}

export default nextConfig
