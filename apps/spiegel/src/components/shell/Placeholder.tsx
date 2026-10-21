import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"

/** ein Bereich, dessen Inhalt noch kommt: Titel und der Schritt, der ihn bringt */
export function Placeholder({ title, sentence }: { title: string; sentence: string }) {
  return (
    <Page>
      <section className={cn("grid gap-3", PAGE_SINGLE)}>
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-foreground-2">{sentence}</p>
      </section>
    </Page>
  )
}
