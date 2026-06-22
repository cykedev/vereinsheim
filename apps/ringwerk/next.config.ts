import type { NextConfig } from "next"
import { createNextConfig } from "@vereinsheim/config/next"

// Geteilte Next-Config aus @vereinsheim/config; __dirname macht
// outputFileTracingRoot app-lokal robust (Monorepo-Wurzel = zwei Ebenen über
// apps/<app>).
const nextConfig: NextConfig = createNextConfig(__dirname)

export default nextConfig
