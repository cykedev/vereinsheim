import type { NextConfig } from "next"
import { createNextConfig } from "@vereinsheim/config/next"

// Geteilte Next-Config aus @vereinsheim/config; __dirname macht
// outputFileTracingRoot app-lokal robust (Monorepo-Wurzel = zwei Ebenen über
// apps/<app>). Dazu die Fachpakete der Statistik (TS-Source ohne Build-Schritt).
const base = createNextConfig(__dirname)
const nextConfig: NextConfig = {
  ...base,
  transpilePackages: [...base.transpilePackages, "@vereinsheim/shot-core", "@vereinsheim/shot-ui"],
}

export default nextConfig
