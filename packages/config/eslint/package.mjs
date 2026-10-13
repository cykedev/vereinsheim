import { defineConfig } from "eslint/config"

import base from "./index.mjs"

// Für die Pakete unter packages/*: dieselben Regeln wie die Apps, ohne das, was nur eine Next-App hat (Pages-Verzeichnis).
// React-Version fest, weil nicht jedes Paket React installiert (sonst Warnung bei „detect“).
const packageConfig = defineConfig([
  ...base,
  {
    settings: { react: { version: "19.2" } },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    // Markup-Tests rufen `createElement` ohne JSX; ist `children` in den Props Pflicht, verlangt der Typ es dort
    // und nicht als drittes Argument
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "react/no-children-prop": "off" },
  },
])

export default packageConfig
