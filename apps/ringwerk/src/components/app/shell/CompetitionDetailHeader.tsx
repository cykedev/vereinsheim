import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DetailActionBar } from "@vereinsheim/ui/shell/DetailActionBar"

import { competitionPageHref, competitionTabs, type CompetitionPage } from "./competitionPages"
import { CompetitionTabs } from "./CompetitionTabs"

interface NavButtonProps {
  href: string
  label: string
  icon: LucideIcon
}

// Ein Link als Aktion der Leiste (etwa „Bearbeiten“): inline-ghost, Icon immer, Label ab sm.
export function DetailNavButton({ href, label, icon: Icon }: NavButtonProps) {
  return (
    <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
      <Link href={href} aria-label={label}>
        <Icon className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    </Button>
  )
}

interface Props {
  // Wettbewerbsname.
  title: string
  // Kontextzeile, z.B. "Luftpistole · Spielplan & Tabelle".
  subtitle: string
  // Optionale dritte Zeile (Datum, Badges).
  meta?: ReactNode
  // Kennung des Wettbewerbs.
  id: string
  // die gezeigte Seite.
  current: CompetitionPage
  // die anderen Seiten des Wettbewerbs, zu denen diese Seite führt (Reiter).
  links: readonly CompetitionPage[]
  // Aktionen der Seite in der Leiste. Reihenfolge: fachlich → destruktiv.
  actions?: ReactNode
}

// Kopf der Wettbewerbs-Unterseiten: Zurück zu den Wettbewerben und die Aktionen der Seite, darunter der Name in der
// Schrift der Marke und die Reiter der Seiten des Wettbewerbs.
export function CompetitionDetailHeader({
  title,
  subtitle,
  meta,
  id,
  current,
  links,
  actions,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/competitions"
          aria-label="Zurück zu Wettbewerbe"
          className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-foreground-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Wettbewerbe
        </Link>
        {actions && <DetailActionBar>{actions}</DetailActionBar>}
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight break-words">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {meta}
      </div>

      <CompetitionTabs
        tabs={competitionTabs(id, current, links)}
        current={competitionPageHref(id, current)}
      />
    </div>
  )
}
