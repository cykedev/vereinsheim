import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminTabs } from "@/components/admin/AdminTabs"
import { SportpassSection } from "@/components/admin/SportpassSection"
import { UserForm } from "@/components/admin/UserForm"
import { consentsOfUser } from "@/lib/consent/queries"
import { requireAdmin } from "@/lib/auth-helpers"
import { updateUser } from "@/lib/users/actions"
import { getUser } from "@/lib/users/queries"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"

export const metadata: Metadata = { title: "Konto" }

// Konto (Admin): Name, Rolle, Status, Passwort und die Zustimmungen per Sportpass; der Reiter „Konten“ führt zurück
export default async function EditUserRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const user = await getUser(id)
  if (!user) notFound()
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminTabs current="users" detail />
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {user.name ?? user.email}
        </h1>
        <UserForm action={updateUser.bind(null, user.id)} user={user} />
        <SportpassSection
          consents={await consentsOfUser(user.id, getDisplayTimeZone())}
          who={user.name ?? user.email}
          accountActive={user.isActive}
        />
      </section>
    </Page>
  )
}
