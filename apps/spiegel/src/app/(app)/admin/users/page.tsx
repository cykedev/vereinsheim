import type { Metadata } from "next"
import Link from "next/link"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { LoginRateLimitInsights } from "@vereinsheim/ui/admin/LoginRateLimitInsights"

import { AdminLoginRateLimitTable } from "@/components/admin/AdminLoginRateLimitTable"
import { AdminTabs } from "@/components/admin/AdminTabs"
import { requireAdmin } from "@/lib/auth-helpers"
import { getAdminLoginRateLimitInsights } from "@/lib/admin/actions"
import { openConsents } from "@/lib/consent/queries"
import { getUsers, type UserListItem } from "@/lib/users/queries"
import { Page } from "@/components/shell/Page"

export const metadata: Metadata = { title: "Konten" }

function UserRow({ user }: { user: UserListItem }) {
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
        <span className="grid shrink-0 justify-items-end text-[13px] text-muted-foreground">
          <span>
            {user.role === "ADMIN" ? "Admin" : "Schütze"}
            {user.isActive ? "" : " · deaktiviert"}
          </span>
          <span data-sportpass-state>{user.sportpass}</span>
        </span>
      </Link>
    </li>
  )
}

// Konten (Admin): Liste mit dem Stand des Sportpasses, neues Konto, Hinweis auf offene Zustimmungen (die stehen auf der
// Übersicht), Sperren der Anmeldung
export default async function AdminUsersRoute() {
  await requireAdmin()
  const timeZone = getDisplayTimeZone()
  const [users, insights, consents] = await Promise.all([
    getUsers(),
    getAdminLoginRateLimitInsights(),
    openConsents(timeZone),
  ])
  return (
    <Page>
      <section className="grid max-w-3xl gap-4">
        <AdminTabs current="users" />
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
        {consents.length > 0 && (
          <Link
            href="/admin"
            data-open-consents-link
            className="justify-self-start rounded-full bg-gold-wash px-3.5 py-2 text-[13px] font-semibold text-gold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {consents.length === 1
              ? "1 Zustimmung wartet auf dich ›"
              : `${consents.length} Zustimmungen warten auf dich ›`}
          </Link>
        )}
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
    </Page>
  )
}
