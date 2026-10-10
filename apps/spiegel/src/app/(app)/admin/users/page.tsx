import type { Metadata } from "next"
import Link from "next/link"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { LoginRateLimitInsights } from "@vereinsheim/ui/admin/LoginRateLimitInsights"

import { AdminLoginRateLimitTable } from "@/components/admin/AdminLoginRateLimitTable"
import { getAdminLoginRateLimitInsights } from "@/lib/admin/actions"
import { getUsers, type UserSummary } from "@/lib/users/queries"

export const metadata: Metadata = { title: "Konten" }

function UserRow({ user }: { user: UserSummary }) {
  return (
    <li>
      <Link
        href={`/admin/users/${user.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="grid min-w-0">
          <span className="truncate text-[15px] font-semibold">{user.name ?? user.email}</span>
          {user.name && (
            <span className="truncate text-[13px] text-muted-foreground">{user.email}</span>
          )}
        </span>
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {user.role === "ADMIN" ? "Admin" : "Schütze"}
          {user.isActive ? "" : " · deaktiviert"}
        </span>
      </Link>
    </li>
  )
}

// Konten (Admin): Liste, neues Konto, Sperren der Anmeldung
export default async function AdminUsersRoute() {
  const [users, insights] = await Promise.all([getUsers(), getAdminLoginRateLimitInsights()])
  const timeZone = getDisplayTimeZone()
  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <section className="grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
              Konten
            </h1>
            <p className="text-foreground-2">
              Konten legt nur ein Admin an; keine Selbstregistrierung.
            </p>
          </div>
          <Link
            href="/admin/users/new"
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Neues Konto
          </Link>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      </section>

      <section className="grid max-w-3xl gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[15px] font-semibold">
          Gesperrte Anmeldungen ({insights.activeBlockedBuckets.length})
        </h2>
        <AdminLoginRateLimitTable
          buckets={insights.activeBlockedBuckets}
          displayTimeZone={timeZone}
        />
      </section>
      <section className="grid max-w-3xl gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[15px] font-semibold">Anmeldeversuche</h2>
        <LoginRateLimitInsights insights={insights} displayTimeZone={timeZone} />
      </section>
    </div>
  )
}
