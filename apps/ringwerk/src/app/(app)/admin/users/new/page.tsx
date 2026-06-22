import { UserCreateForm } from "@/components/app/users/UserCreateForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Neuer Nutzer" />
      </div>
      <UserCreateForm />
    </div>
  )
}
