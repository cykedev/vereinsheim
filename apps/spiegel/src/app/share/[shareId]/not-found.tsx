import { Page } from "@vereinsheim/ui/design2/page"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"

// Ein Link zum Teilen, der nicht (mehr) geht: ohne Link in die App, die braucht eine Anmeldung
export default function SharedCardNotFound() {
  return (
    <Page className="max-w-2xl">
      <div data-share-gone className="grid gap-3">
        <PageHeader
          title="Diese Scheibe ist nicht mehr geteilt"
          description="Der Link geht nicht mehr. Das Teilen wurde beendet oder die Scheibe gelöscht."
        />
        <p className="text-foreground-2">Wer die Scheibe zeigen will, schickt einen neuen Link.</p>
      </div>
    </Page>
  )
}
