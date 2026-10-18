import { Page } from "@vereinsheim/ui/design2/page"

/** ein Bereich, dessen Inhalt noch kommt: Titel und der Schritt, der ihn bringt */
export function Placeholder({ title, sentence }: { title: string; sentence: string }) {
  return (
    <Page>
      <section className="grid max-w-2xl gap-3">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-foreground-2">{sentence}</p>
      </section>
    </Page>
  )
}
