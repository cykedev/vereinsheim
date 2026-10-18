import type { HelpTopic, ViewHelp } from "@vereinsheim/shot-help/types"
import { HelpBody as Body } from "@vereinsheim/ui/design2/help"

export { HELP_FIELDS } from "@vereinsheim/ui/design2/help"

export interface HelpBodyProps {
  /** Erklärung einer Kennzahl oder Auswertung (`helpTopic`) oder der Oberfläche (`VIEW_HELP`) */
  topic: HelpTopic | ViewHelp
  className?: string
}

/** Die Erklärung selbst aus `shot-help`, gezeigt mit dem Baustein aus Design 2 */
export function HelpBody({ topic, className }: HelpBodyProps) {
  return <Body topic={topic} className={className} />
}
