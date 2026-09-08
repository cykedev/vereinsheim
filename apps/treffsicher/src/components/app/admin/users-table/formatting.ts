import { formatDateTime, formatInteger } from "@vereinsheim/lib/format"

import type { AdminUserListItem } from "@/lib/admin/actions"

export function getRoleBadgeClass(role: AdminUserListItem["role"]): string {
  if (role === "ADMIN") {
    return "border-warning/40 bg-warning/10 text-warning"
  }
  return "border-info/40 bg-info/10 text-info"
}

export function getStatusBadgeClass(isActive: boolean): string {
  if (isActive) {
    return "border-success/40 bg-success/10 text-success"
  }
  return "border-border bg-muted text-muted-foreground"
}

export function formatDate(date: Date, displayTimeZone: string): string {
  return formatDateTime(new Date(date), displayTimeZone)
}

export function formatOptionalDate(date: Date | null, displayTimeZone: string): string {
  if (!date) return "—"
  return formatDate(date, displayTimeZone)
}

export function formatCount(value: number): string {
  return formatInteger(value)
}
