import type { Metadata } from "next"

import { AdminTabs } from "@/components/admin/AdminTabs"
import { UserForm } from "@/components/admin/UserForm"
import { requireAdmin } from "@/lib/auth-helpers"
import { createUser } from "@/lib/users/actions"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"

export const metadata: Metadata = { title: "Neues Konto" }

export default async function NewUserRoute() {
  await requireAdmin()
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminTabs current="users" detail />
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          Neues Konto
        </h1>
        <UserForm action={createUser} />
      </section>
    </Page>
  )
}
