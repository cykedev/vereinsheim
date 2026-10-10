import type { TargetId } from "@vereinsheim/shot-core/targets"

import type { OverviewCard } from "@/lib/db/reads"

/** eine Familie, wie die Seiten sie zeigen: Kennung (Adresse), Name, Scheibenbild für die kleinen Scheiben */
export interface FamilyOption {
  value: string
  label: string
  targetId: TargetId
}

/**
 * Die Familien der Scheiben eines Schützen, die mit der neuesten Scheibe zuerst; das Scheibenbild ist das der neuesten
 * Scheibe der Familie. Scheiben ohne Familie oder Scheibenbild fehlen in den Übersichten.
 */
export function familiesOf(cards: readonly OverviewCard[]): FamilyOption[] {
  const families = new Map<string, FamilyOption>()
  for (const card of [...cards].sort((a, b) => b.startedAtMs - a.startedAtMs)) {
    if (!card.family || !card.targetId || families.has(card.family.slug)) continue
    families.set(card.family.slug, {
      value: card.family.slug,
      label: card.family.name,
      targetId: card.targetId,
    })
  }
  return [...families.values()]
}

/** die Scheiben, die die Übersichten zeigen können: mit Familie und Scheibenbild */
export const listable = (cards: readonly OverviewCard[]) =>
  cards.filter((card) => card.family && card.targetId)

/** die Scheiben der Übersichten mit ihrer Familie, wie die Modelle in `shot-ui` sie nehmen (nur aus `listable`) */
export const withFamily = (cards: readonly OverviewCard[]) =>
  cards.map((card) => ({ card, family: card.family!.slug }))
