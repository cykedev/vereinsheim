import type { ReactNode } from "react"

/**
 * Seitenkopf in Design 2: Titel in der Schrift der Marke wie Spiegels Seiten, darunter optional ein Satz, rechts
 * optional eine Aktion.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid gap-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {description && <p className="text-foreground-2">{description}</p>}
      </div>
      {action}
    </div>
  )
}
