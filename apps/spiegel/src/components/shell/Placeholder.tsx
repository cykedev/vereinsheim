/** ein Bereich, dessen Inhalt noch kommt: Titel und der Schritt, der ihn bringt (wie im Labor) */
export function Placeholder({ title, sentence }: { title: string; sentence: string }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <section className="grid max-w-2xl gap-3">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-foreground-2">{sentence}</p>
      </section>
    </div>
  )
}
