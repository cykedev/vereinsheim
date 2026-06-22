import { Badge } from "@/components/ui/badge"
import {
  AUDIT_EVENT_CATEGORY,
  AUDIT_EVENT_LABELS,
  formatAuditDetails,
  getAuditDescription,
  type AuditEventCategory,
} from "@/lib/auditLog/types"
import type { AuditLogEntry, AuditLogEntryWithCompetition } from "@/lib/auditLog/queries"

const CATEGORY_BADGE_CLASS: Record<AuditEventCategory, string> = {
  participant: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  result: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  playoff: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  admin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type Entry = AuditLogEntry | AuditLogEntryWithCompetition

function hasCompetition(entry: Entry): entry is AuditLogEntryWithCompetition {
  return "competition" in entry
}

interface Props {
  entries: Entry[]
  showLeagueName?: boolean
}

export function AuditLogList({ entries, showLeagueName = false }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Keine Protokolleinträge vorhanden.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="divide-y">
        {entries.map((entry) => {
          const label = AUDIT_EVENT_LABELS[entry.eventType] ?? entry.eventType
          const category = AUDIT_EVENT_CATEGORY[entry.eventType] ?? "result"
          const badgeClass = CATEGORY_BADGE_CLASS[category]
          const details = formatAuditDetails(entry.eventType, entry.details)
          const description = getAuditDescription(entry.eventType, entry.details)
          const leagueName =
            showLeagueName && hasCompetition(entry) ? (entry.competition?.name ?? null) : null

          return (
            <details key={entry.id} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`shrink-0 text-xs font-medium ${badgeClass}`}>{label}</Badge>
                    {leagueName && (
                      <span className="text-xs text-muted-foreground">{leagueName}</span>
                    )}
                  </div>
                  {description && <p className="text-sm font-medium">{description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {entry.user.name ?? "Unbekannt"} · {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <span className="mt-0.5 shrink-0 text-xs text-muted-foreground group-open:hidden">
                  Details
                </span>
                <span className="mt-0.5 hidden shrink-0 text-xs text-muted-foreground group-open:block">
                  Schließen
                </span>
              </summary>
              {details.length > 0 && (
                <div className="border-t bg-muted/20 px-4 py-3">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    {details.map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-xs text-muted-foreground">{row.label}</dt>
                        <dd className="text-xs font-medium">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </details>
          )
        })}
      </div>
    </div>
  )
}
