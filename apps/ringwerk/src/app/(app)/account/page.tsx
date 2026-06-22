import { AccountPasswordForm } from "@/components/app/account/AccountPasswordForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Mein Konto" description="Passwort ändern" />
      </div>
      <AccountPasswordForm />
    </div>
  )
}
