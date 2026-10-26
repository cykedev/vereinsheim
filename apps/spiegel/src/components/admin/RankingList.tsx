import Link from "next/link"

import type { RankingRow } from "@/lib/admin/rankings"

const LIST = "divide-y divide-border overflow-hidden rounded-xl border border-border"

/** die Abschnitte der Seite: erst die nicht festgelegten, dann je Art */
const SECTIONS = [
  { title: "Nicht festgelegt", kind: null },
  { title: "Wettkampf", kind: "competition" },
  { title: "Training", kind: "training" },
] as const

/** wie viele Scheiben und der Monat der letzten, als Zusatz der Zeile und unter dem Namen auf dem Blatt */
export function rankingFacts(row: RankingRow): string {
  const cards =
    row.cards === 0 ? "noch keine Scheibe" : row.cards === 1 ? "1 Scheibe" : `${row.cards} Scheiben`
  return row.lastCardMonth ? `${cards} · zuletzt im ${row.lastCardMonth}` : cards
}

/** die Listen aus Meyton in Abschnitten nach ihrer Art, wie die Disziplinen; jede Zeile führt aufs Blatt der Liste */
export function RankingList({ rows }: { rows: readonly RankingRow[] }) {
  return (
    <div className="grid gap-5">
      {SECTIONS.map(({ title, kind }) => {
        const own = rows.filter((row) => row.kind === kind)
        if (!own.length) return null
        return (
          <section key={title} className="grid gap-2" data-ranking-section={kind ?? "open"}>
            <h2 className="text-[13px] font-semibold text-foreground-2">{title}</h2>
            <ul className={LIST}>
              {own.map((row) => (
                <li key={row.id} data-ranking={row.id}>
                  <Link
                    href={`/admin/lists/${row.id}`}
                    className="grid min-w-0 px-4 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="truncate text-[15px] font-semibold">{row.name}</span>
                    <span className="text-[13px] text-muted-foreground">{rankingFacts(row)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
