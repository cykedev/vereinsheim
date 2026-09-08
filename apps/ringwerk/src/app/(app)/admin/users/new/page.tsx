import { UserCreateForm } from "@/components/app/users/UserCreateForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Neuer Nutzer" />
      <UserCreateForm />
    </div>
  )
}
