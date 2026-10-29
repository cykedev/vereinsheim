"use client"

import Link from "next/link"

import { JUMP_BAR } from "@vereinsheim/ui/design2/bar"
import { TabBar } from "@vereinsheim/ui/design2/tab-bar"

/** eine Seite eines Wettbewerbs */
export interface CompetitionTab {
  href: string
  label: string
}

/** Reiter der Seiten eines Wettbewerbs über `TabBar`; `current` ist die Adresse der gezeigten Seite */
export function CompetitionTabs({ tabs, current }: { tabs: CompetitionTab[]; current: string }) {
  const items = tabs.map((t) => ({ key: t.href, label: t.label, href: t.href }))
  return (
    <TabBar
      label="Seiten des Wettbewerbs"
      items={items}
      current={current}
      className={JUMP_BAR.height}
      renderLink={(tab, props) => <Link href={tab.href} {...props} />}
    />
  )
}
