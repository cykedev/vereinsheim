"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import type { PartLine } from "@/lib/part-line"

/**
 * Die Aktion einer Zeile eines anderen Teils: ein Link, oder mit `run` ein Knopf, der die Action ruft und danach
 * ihr Ziel öffnet. Fehler als Toast.
 */
export function PartLineAction({
  line,
  className,
  children,
}: {
  line: PartLine
  className: string
  children: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = line.run
  if (!run)
    return (
      <Link href={line.href} data-part-line={line.key} className={className}>
        {children}
      </Link>
    )
  return (
    <button
      type="button"
      data-part-line={line.key}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await run()
          if ("error" in result) {
            toast.error(
              getErrorMessage(result) ?? "Das ging gerade nicht. Bitte noch einmal versuchen."
            )
            return
          }
          if (result.data?.toast) toast.success(result.data.toast)
          if (result.data) router.push(result.data.href)
        })
      }
      className={`${className} cursor-pointer disabled:opacity-60`}
    >
      {children}
    </button>
  )
}
