import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { SportpassSection } from "@/components/admin/SportpassSection"
import { UserForm } from "@/components/admin/UserForm"
import { consentsOfUser } from "@/lib/consent/queries"
import { requireAdmin } from "@/lib/auth-helpers"
import { updateUser } from "@/lib/users/actions"
import { getUser } from "@/lib/users/queries"
import { Page } from "@/components/shell/Page"

export const metadata: Metadata = { title: "Konto" }

export default async function EditUserRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const user = await getUser(id)
  if (!user) notFound()
  return (
    <Page>
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        {user.name ?? user.email}
      </h1>
      <UserForm action={updateUser.bind(null, user.id)} user={user} />
      <SportpassSection
        userId={user.id}
        consents={await consentsOfUser(user.id, getDisplayTimeZone())}
      />
    </Page>
  )
}
