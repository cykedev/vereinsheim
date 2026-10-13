"use client"

import { Segmented } from "@vereinsheim/ui/design2/segmented"

import { useTheme } from "./ThemeProvider"

/** Darstellung System, Hell, Dunkel: am Desktop unten in der Seitenleiste, auf dem Telefon in Profil */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div data-theme-switch className={`grid gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-semibold text-muted-foreground">Darstellung</span>
      <Segmented
        label="Darstellung"
        value={theme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Hell" },
          { value: "dark", label: "Dunkel" },
        ]}
        onChange={setTheme}
        className="w-full [&>button]:flex-1 [&>button]:px-2"
      />
    </div>
  )
}
