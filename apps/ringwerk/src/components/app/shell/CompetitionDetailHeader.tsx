import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DetailActionBar } from "@vereinsheim/ui/shell/DetailActionBar"

interface NavButtonProps {
  href: string
  label: string
  icon: LucideIcon
}

// Ein Navigations-Eintrag der Detail-Aktionsleiste: inline-ghost, Icon immer,
// Label ab sm. Ersetzt die früheren `outline`-Icon-Buttons ohne sichtbares Label.
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
  // Fachliche Aktionen in der Leiste. Reihenfolge: fachlich → destruktiv;
  // "Zurück" hängt diese Komponente selbst an, damit es überall gleich sitzt.
  actions?: ReactNode
}

// Kanonischer Kopf der Wettbewerbs-Unterseiten (vault/conventions.md §2:
// DetailActionBar oben rechts + rohes h1 darunter — dasselbe Muster wie in
// Treffsichers Detailseiten).
export function CompetitionDetailHeader({ title, subtitle, meta, actions }: Props) {
  return (
    <div className="space-y-4">
      <DetailActionBar>
        {actions}
        <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link href="/competitions" aria-label="Zurück zu Wettbewerbe">
            <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Zurück</span>
          </Link>
        </Button>
      </DetailActionBar>

      <div className="space-y-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {meta}
      </div>
    </div>
  )
}
