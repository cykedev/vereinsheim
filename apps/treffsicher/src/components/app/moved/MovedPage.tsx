import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/design2/card"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"

import { MOVED_PAGES, MOVED_TEXTS, type MovedPageKind } from "@/lib/moved/texts"

/**
 * Seite statt eines Formulars zum Anlegen oder Bearbeiten für ein Konto, das nach Spiegel umgezogen ist
 * ([[adr-033]], Stufe 3): der bisherige Titel der Seite und eine Karte, wo das jetzt geht. Kein eigener Knopf, der
 * Hinweis direkt darüber trägt „Zu Spiegel“.
 */
export function MovedPage({ kind }: { kind: MovedPageKind }) {
  const { title, text } = MOVED_PAGES[kind]
  return (
    <div data-moved-page={kind} className="space-y-6">
      <PageHeader title={title} />
      <Card>
        <CardHeader>
          <CardTitle>{MOVED_TEXTS.pageTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-2">{text}</p>
        </CardContent>
      </Card>
    </div>
  )
}
