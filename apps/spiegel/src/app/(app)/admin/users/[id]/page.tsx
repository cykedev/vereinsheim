import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { UserForm } from "@/components/admin/UserForm"
import { updateUser } from "@/lib/users/actions"
import { getUser } from "@/lib/users/queries"

export const metadata: Metadata = { title: "Konto" }

export default async function EditUserRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser(id)
  if (!user) notFound()
  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 pt-7 pb-24">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        {user.name ?? user.email}
      </h1>
      <UserForm action={updateUser.bind(null, user.id)} user={user} />
    </div>
  )
}
