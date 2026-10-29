"use client"

import Link from "next/link"

import { TabBar } from "@vereinsheim/ui/design2/tab-bar"

import { ANALYSIS_TEXTS } from "../analysis/texts"
import { GOAL_TEXTS } from "../goals/texts"
import { ANALYSIS_PATH, ROUTINES_PATH } from "../paths"
import { ROUTINE_TEXTS } from "../routines/texts"
import { LIST_TEXTS } from "../texts"

/** die Reiter des Tagebuchs in ihrer Folge */
export const DIARY_TABS = [
  { key: "entries", label: LIST_TEXTS.entries, href: "/diary" },
  { key: "thread", label: LIST_TEXTS.thread, href: "/diary/thread" },
  { key: "goals", label: GOAL_TEXTS.tab, href: "/diary/goals" },
  { key: "routines", label: ROUTINE_TEXTS.tab, href: ROUTINES_PATH },
  { key: "analysis", label: ANALYSIS_TEXTS.tab, href: ANALYSIS_PATH },
] as const

export type DiaryTab = (typeof DIARY_TABS)[number]["key"]

/** „Einträge · Fragen · Ziele · Abläufe · Auswertung“: eine Zeile, die wischt, der gezeigte Reiter rückt ins Bild */
export function DiaryTabs({ current }: { current: DiaryTab }) {
  return (
    <div data-diary-switch className="min-w-0">
      <TabBar
        label={LIST_TEXTS.title}
        items={DIARY_TABS}
        current={current}
        renderLink={(tab, props) => <Link href={tab.href} {...props} />}
      />
    </div>
  )
}
