import { AccountPasswordForm } from "@/components/app/account/AccountPasswordForm"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/card"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Konto"
        description="Ändere dein Passwort. Nach dem Speichern wirst du aus Sicherheitsgründen abgemeldet."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountPasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
