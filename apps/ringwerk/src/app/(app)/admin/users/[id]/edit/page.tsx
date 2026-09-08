import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getUserById } from "@/lib/users/queries"
import { updateUser } from "@/lib/users/actions"
import { UserEditForm } from "@/components/app/users/UserEditForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Nutzer bearbeiten",
}

export default async function EditUserPage({ params }: Props) {
  const { id } = await params
  const user = await getUserById(id)
  if (!user) notFound()

  const action = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return updateUser(id, prevState, formData)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Nutzer bearbeiten" />
      <UserEditForm user={user} action={action} />
    </div>
  )
}
