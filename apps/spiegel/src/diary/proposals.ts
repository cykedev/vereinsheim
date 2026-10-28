// Vorschläge für einen neuen Eintrag: je Abend und Disziplin die Scheiben, die in keinem Eintrag stecken, an Abenden
// ohne Eintrag dieser Disziplin. Hat ein Abend schon einen Eintrag, kommen seine neuen Scheiben dort an (`entryCards`).
// Reine Funktion.

export interface ProposalCard {
  id: string
  day: string
  startedAtMs: number
  family: { id: number; slug: string; name: string } | null
}

export interface Proposal<C extends ProposalCard = ProposalCard> {
  day: string
  family: { id: number; slug: string; name: string }
  /** in zeitlicher Folge */
  cards: C[]
  /** die Scheibe aus der Adresse (`?card=`) gehört dazu */
  marked: boolean
}

/**
 * `entries`: die Einträge des Kontos (auch im Papierkorb), `linked`: Kennungen der Scheiben mit einer Zeile `linked`
 * eines Eintrags, der nicht im Papierkorb liegt (sie stecken fest in ihm). Neueste Abende zuerst, an einem Abend nach Name der
 * Disziplin. Scheiben ohne Disziplin fehlen: Ein Eintrag mit Scheiben braucht eine.
 */
export function proposals<C extends ProposalCard>(
  cards: readonly C[],
  entries: readonly { day: string; familyId: number | null; deleted: boolean }[],
  linked: ReadonlySet<string>,
  markedCardId?: string | null
): Proposal<C>[] {
  const taken = new Set(
    entries.filter((e) => !e.deleted && e.familyId !== null).map((e) => `${e.day}|${e.familyId}`)
  )
  const groups = new Map<string, Proposal<C>>()
  for (const card of cards) {
    if (!card.family || linked.has(card.id)) continue
    const key = `${card.day}|${card.family.id}`
    if (taken.has(key)) continue
    const group = groups.get(key) ?? {
      day: card.day,
      family: card.family,
      cards: [],
      marked: false,
    }
    group.cards.push(card)
    if (card.id === markedCardId) group.marked = true
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      cards: group.cards.sort((a, b) => a.startedAtMs - b.startedAtMs),
    }))
    .sort((a, b) => b.day.localeCompare(a.day) || a.family.name.localeCompare(b.family.name, "de"))
}
