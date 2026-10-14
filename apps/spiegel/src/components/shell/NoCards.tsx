/** Leerzustand ohne eigene Scheiben, eine Stelle für Start und Liste (Konventionen §2) */
export function NoCards({ title = "Noch keine Scheiben" }: { title?: string }) {
  return (
    <section data-no-cards className="rounded-2xl border border-border bg-card p-6">
      <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sobald die Brücke deine Scheiben bringt, stehen sie hier. Dafür im Profil der Übertragung
        per Sportpass zustimmen.
      </p>
    </section>
  )
}
