import { Segmented } from "@vereinsheim/ui/design2/segmented"

import type { Theme } from "./LaborHeader"

/**
 * Darstellung System, Hell, Dunkel (Labor näher an der App, D2): eine Einstellung der App, am Desktop unten in der
 * Seitenleiste, auf dem Telefon in Profil.
 */
export function ThemeSwitch({
  theme,
  onTheme,
  className,
}: {
  theme: Theme
  onTheme: (theme: Theme) => void
  className?: string
}) {
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
        onChange={onTheme}
      />
    </div>
  )
}
