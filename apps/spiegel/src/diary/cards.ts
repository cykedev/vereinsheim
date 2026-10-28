// Welche Scheiben zu welchem Eintrag gehören (entschieden mit dem User am 28. Oktober 2026, [[adr-033]]). Gespeichert
// wird nur, was der Schütze tut: Anlegen und Dazunehmen verknüpfen (`linked`), Lösen löst (`released`). Alles andere
// leitet diese reine Funktion beim Lesen ab, ohne zu schreiben.

export interface EntryRef {
  id: string
  /** der Abend (ISO-Tag) */
  day: string
  familyId: number | null
  /** im Papierkorb */
  deleted: boolean
}

export interface CardLinkRow {
  cardId: string
  entryId: string
  link: "linked" | "released"
}

export interface CardRef {
  id: string
  day: string
  familyId: number | null
}

export interface EntryCardSet {
  /** fest verknüpft, auch Scheiben, die es nicht mehr gibt („Scheibe gelöscht“) */
  linked: string[]
  /** ohne Zeile: der einzige Eintrag des Abends und der Disziplin („dazugekommen“) */
  added: string[]
  /** vom selben Abend und derselben Disziplin, aber nicht von selbst: mehrere Einträge, oder gelöst („Dazunehmen“) */
  offered: string[]
}

const evening = (day: string, familyId: number | null) => `${day}|${familyId}`

/** die Zeilen, die gelten: Ein Eintrag im Papierkorb hält keine Scheibe fest, seine Zeilen bleiben für das Wiederherstellen */
export const activeLinks = (entries: readonly EntryRef[], links: readonly CardLinkRow[]) => {
  const deleted = new Set(entries.filter((entry) => entry.deleted).map((entry) => entry.id))
  return links.filter((row) => !deleted.has(row.entryId))
}

/**
 * Je Eintrag seine Scheiben:
 * - eine Zeile `linked` hält die Scheibe in ihrem Eintrag; liegt er im Papierkorb, ist die Scheibe frei;
 * - eine Scheibe ohne Zeile gehört zum einzigen Eintrag ihres Abends und ihrer Disziplin, der nicht im Papierkorb
 *   liegt; gibt es mehrere, bietet jeder sie an;
 * - eine gelöste Scheibe kommt nicht von selbst wieder, jeder Eintrag ihres Abends und ihrer Disziplin bietet sie an.
 * Einträge im Papierkorb halten, nehmen und bieten nichts; ihre Zeilen zählen nicht.
 */
export function entryCards(
  entries: readonly EntryRef[],
  allLinks: readonly CardLinkRow[],
  cards: readonly CardRef[]
): Map<string, EntryCardSet> {
  const links = activeLinks(entries, allLinks)
  const result = new Map<string, EntryCardSet>(
    entries.map((entry) => [entry.id, { linked: [], added: [], offered: [] }])
  )
  const open = new Map<string, EntryRef[]>()
  for (const entry of entries) {
    if (entry.deleted || entry.familyId === null) continue
    const key = evening(entry.day, entry.familyId)
    open.set(key, [...(open.get(key) ?? []), entry])
  }
  const rowOf = new Map(links.map((row) => [row.cardId, row]))
  for (const row of links)
    if (row.link === "linked") result.get(row.entryId)?.linked.push(row.cardId)
  for (const card of cards) {
    if (card.familyId === null) continue
    const row = rowOf.get(card.id)
    if (row?.link === "linked") continue
    const candidates = open.get(evening(card.day, card.familyId)) ?? []
    if (!row && candidates.length === 1) result.get(candidates[0].id)!.added.push(card.id)
    else for (const entry of candidates) result.get(entry.id)!.offered.push(card.id)
  }
  return result
}

/** Der Eintrag einer Scheibe: der fest verknüpfte (nicht im Papierkorb), sonst der abgeleitete; null ohne. */
export function entryOfCard(
  card: CardRef,
  entries: readonly EntryRef[],
  links: readonly CardLinkRow[]
): string | null {
  const row = activeLinks(entries, links).find((link) => link.cardId === card.id)
  if (row?.link === "linked")
    return entries.find((entry) => entry.id === row.entryId && !entry.deleted)?.id ?? null
  for (const [entryId, set] of entryCards(entries, links, [card]))
    if (set.added.includes(card.id)) return entryId
  return null
}

/**
 * Wo eine Scheibe im Tagebuch steht, für die Stellen an Scheibe und Start: in einem Eintrag (fest oder dazugekommen),
 * nur angeboten (gelöst, oder mehrere Einträge des Abends; der erste bietet sie zum Dazunehmen an), oder nirgends. Ein
 * Eintrag im Papierkorb hält sie nicht. So führt jede Zeile dorthin, wo sich etwas tun lässt.
 */
export type CardPlace =
  { kind: "entry"; entryId: string } | { kind: "offered"; entryId: string } | { kind: "none" }

export function cardPlace(
  card: CardRef,
  entries: readonly EntryRef[],
  links: readonly CardLinkRow[]
): CardPlace {
  const entryId = entryOfCard(card, entries, links)
  if (entryId) return { kind: "entry", entryId }
  for (const [id, set] of entryCards(entries, links, [card]))
    if (set.offered.includes(card.id)) return { kind: "offered", entryId: id }
  return { kind: "none" }
}
