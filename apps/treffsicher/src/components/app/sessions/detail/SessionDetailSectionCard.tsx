import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/design2/card"
import { HelpMark, HelpShort } from "@/components/app/help/Explain"
import type { HelpTopicId } from "@/lib/help/topics"

interface Props {
  title: string
  icon: LucideIcon
  headerSuffix?: ReactNode
  /** Thema der Hilfe: „?“ im Kopf und der Kurzsatz bei „Erklärungen“ */
  help?: HelpTopicId
  children: ReactNode
}

export function SessionDetailSectionCard({
  title,
  icon: Icon,
  headerSuffix,
  help,
  children,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          {headerSuffix}
          {help && <HelpMark id={help} />}
        </CardTitle>
        {help && <HelpShort id={help} />}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
