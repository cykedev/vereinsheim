import type { Metadata } from "next"
import { UserCreateForm } from "@/components/app/users/UserCreateForm"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"

export const metadata: Metadata = {
  title: "Neuer Nutzer",
}

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Neuer Nutzer" />
      <UserCreateForm />
    </div>
  )
}
