import { RouteLink } from "@vereinsheim/shot-ui/nav/RouteLink"

import { LaborPanel, type LaborPanelProps, type Theme } from "./LaborPanel"
import { ThemeSwitch } from "./ThemeSwitch"

/** die Bereiche, die das Labor nur andeutet (Plan N3, D7; Start seit N5 echt) */
export type PlaceholderPage = "scan" | "profile" | "admin"

const TEXT: Readonly<Record<PlaceholderPage, { title: string; sentence: string }>> = {
  scan: {
    title: "QR scannen",
    sentence:
      "Scannen kommt mit der Zuordnung über den Meyton-QR (SP-1.7, N6): Vorschau, Bestätigen, dann die Seite der neuen Scheibe.",
  },
  profile: {
    title: "Profil",
    sentence:
      "Profil kommt mit N7: Zuordnung über den Sportpass, Freigaben, Export und der Papierkorb.",
  },
  admin: {
    title: "Admin",
    sentence: "Admin kommt mit N7: Anlagen, Brücken, Zuordnungen, Scheibenbilder und Nutzer.",
  },
}

/**
 * Platzhalter für Scannen, Profil und Admin im Labor: der Bereich mit dem Schritt, der ihn bringt. Profil
 * enthält „Admin“, wie auf dem Telefon (Entscheidung 16).
 */
export function PlaceholderView({
  header,
  page,
  theme,
  onTheme,
}: {
  header: Omit<LaborPanelProps, "children" | "hint" | "address">
  page: PlaceholderPage
  /** Darstellung: in Profil, wo die Einstellung in der App lebt (Labor näher an der App, D2) */
  theme: Theme
  onTheme: (theme: Theme) => void
}) {
  const { title, sentence } = TEXT[page]
  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <section data-placeholder={page} className="grid max-w-2xl gap-3">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-foreground-2">{sentence}</p>
        {page === "profile" && (
          <ThemeSwitch theme={theme} onTheme={onTheme} className="justify-self-start" />
        )}
        {page === "profile" && (
          <RouteLink
            route={{ page: "admin", section: null }}
            data-profile-admin
            className="justify-self-start rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
          >
            Admin
          </RouteLink>
        )}
      </section>
      {/* zuletzt: der Knopf steht unten rechts, also auch zuletzt in der Tab-Folge (Review) */}
      <LaborPanel
        {...header}
        hint="Platzhalter: Der Rahmen ist echt, der Inhalt dieses Bereichs folgt."
      />
    </div>
  )
}
