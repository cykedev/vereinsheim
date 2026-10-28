"use client"

import Link from "next/link"

import type { PartLine } from "@/lib/part-line"

import { ActionRow } from "./ActionRow"

/** eine Zeile eines anderen Teils im Kasten „Diese Scheibe“, mit Link als Aktion */
export function PartLineRow({ line }: { line: PartLine }) {
  return (
    <ActionRow
      data-part-line={line.key}
      title={line.title}
      state={line.state}
      action={
        <Link
          href={line.href}
          className="inline-flex h-10 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
        >
          {line.action}
        </Link>
      }
    />
  )
}
