import type { Metadata } from "next"

import { UserForm } from "@/components/admin/UserForm"
import { requireAdmin } from "@/lib/auth-helpers"
import { createUser } from "@/lib/users/actions"
import { Page } from "@/components/shell/Page"

export const metadata: Metadata = { title: "Neues Konto" }

export default async function NewUserRoute() {
  await requireAdmin()
  return (
    <Page>
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        Neues Konto
      </h1>
      <UserForm action={createUser} />
    </Page>
  )
}
