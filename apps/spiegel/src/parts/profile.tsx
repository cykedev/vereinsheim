// Nahtstelle im Profil: was das Tagebuch dort zeigt. Das Profil kennt nur die Plätze, nicht das Tagebuch ([[adr-033]]).

import { List } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { DiaryProfileBox } from "@/diary/components/DiaryProfileBox"
import { diarySettings } from "@/diary/settings"
import { PROFILE_TEXTS } from "@/diary/texts"
import type { Db } from "@/lib/db"

const PILL =
  "inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"

/**
 * Oben im Profil: der Kasten „Tagebuch“; ist es an, darüber am Telefon „Alle Scheiben“, weil die Scheiben dann nicht in
 * der unteren Leiste stehen (conventions §5). Ab 1024 px stehen sie in der Seitenleiste.
 */
export async function profileParts(db: Db, userId: string): Promise<{ diary: ReactNode }> {
  const { enabled } = await diarySettings(db, userId)
  return {
    diary: (
      <>
        {enabled && (
          <nav aria-label={PROFILE_TEXTS.allCards} data-all-cards className="lg:hidden">
            <Link href="/cards" className={PILL}>
              <List aria-hidden className="size-4" />
              {PROFILE_TEXTS.allCards}
            </Link>
          </nav>
        )}
        <DiaryProfileBox enabled={enabled} />
      </>
    ),
  }
}
