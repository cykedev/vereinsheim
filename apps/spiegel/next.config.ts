import type { NextConfig } from "next"
import { createNextConfig } from "@vereinsheim/config/next"

// Geteilte Next-Config aus @vereinsheim/config; Spiegel transpiliert dazu seine Fachpakete (TS-Source ohne
// Build-Schritt).
const base = createNextConfig(__dirname)
const nextConfig: NextConfig = {
  ...base,
  transpilePackages: [
    ...base.transpilePackages,
    "@vereinsheim/shot-core",
    "@vereinsheim/ingest-contract",
  ],
}

export default nextConfig
