import { PageHeader } from "@vereinsheim/ui/design2/page-header"

// Ein Link zum Teilen, der nicht (mehr) geht: ohne Link in die App, die braucht eine Anmeldung
export default function SharedCardNotFound() {
  return (
    <main data-share-gone className="mx-auto grid max-w-2xl gap-3 px-4 py-12">
      <PageHeader
        title="Diese Scheibe ist nicht mehr geteilt"
        description="Der Link geht nicht mehr. Das Teilen wurde beendet oder die Scheibe gelöscht."
      />
      <p className="text-foreground-2">Wer die Scheibe zeigen will, schickt einen neuen Link.</p>
    </main>
  )
}
