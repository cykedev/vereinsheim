import { AccountPasswordForm } from "@/components/app/account/AccountPasswordForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Mein Konto" description="Passwort ändern" />
      <AccountPasswordForm />
    </div>
  )
}
