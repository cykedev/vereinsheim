import type { ReactNode } from "react"

import { formatDateTimeSeconds, formatInteger } from "@vereinsheim/lib/format"
import type { AdminLoginRateLimitBucket } from "@vereinsheim/lib/auth/rate-limit/adminTypes"

import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"

/** EMAIL- und IP-Buckets sollen auf einen Blick unterscheidbar sein. */
export function bucketTypeBadgeClass(type: AdminLoginRateLimitBucket["type"]): string {
  return type === "IP"
    ? "border-warning/40 bg-warning/10 text-warning"
    : "border-info/40 bg-info/10 text-info"
}

export function formatBucketDate(date: Date | null, displayTimeZone: string): string {
  if (!date) return "—"
  return formatDateTimeSeconds(new Date(date), displayTimeZone)
}

interface Props {
  buckets: AdminLoginRateLimitBucket[]
  displayTimeZone: string
  emptyText: string
  /** Optionale Aktionsspalte (z.B. Entsperren) — ohne sie entfällt die Spalte. */
  renderAction?: (bucket: AdminLoginRateLimitBucket) => ReactNode
}

// Eine Tabelle für beide Sichten (aktive Sperren und "top noisy"), damit die
// Darstellung deckungsgleich bleibt.
export function LoginRateLimitBucketTable({
  buckets,
  displayTimeZone,
  emptyText,
  renderAction,
}: Props) {
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow className="text-muted-foreground">
          <TableHead className="pb-2 pr-4">Typ</TableHead>
          <TableHead className="pb-2 pr-4">Identifikator</TableHead>
          <TableHead className="pb-2 pr-4">Fehlversuche</TableHead>
          <TableHead className="pb-2 pr-4">Fenster seit</TableHead>
          <TableHead className="pb-2 pr-4">Letzter Versuch</TableHead>
          <TableHead className={renderAction ? "pb-2 pr-4" : "pb-2"}>Blockiert bis</TableHead>
          {renderAction && <TableHead className="pb-2">Aktion</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets.map((bucket) => (
          <TableRow key={bucket.key}>
            <TableCell className="py-2 pr-4">
              <Badge variant="outline" className={bucketTypeBadgeClass(bucket.type)}>
                {bucket.type}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[300px] py-2 pr-4">
              <p className="break-all whitespace-normal">{bucket.identifier}</p>
            </TableCell>
            <TableCell className="py-2 pr-4">
              <span className="tabular-nums">{formatInteger(bucket.attempts)}</span>
            </TableCell>
            <TableCell className="py-2 pr-4 text-muted-foreground">
              {formatBucketDate(bucket.windowStartedAt, displayTimeZone)}
            </TableCell>
            <TableCell className="py-2 pr-4 text-muted-foreground">
              {formatBucketDate(bucket.lastAttemptAt, displayTimeZone)}
            </TableCell>
            <TableCell
              className={
                renderAction ? "py-2 pr-4 text-muted-foreground" : "py-2 text-muted-foreground"
              }
            >
              {formatBucketDate(bucket.blockedUntil, displayTimeZone)}
            </TableCell>
            {renderAction && <TableCell className="py-2">{renderAction(bucket)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
