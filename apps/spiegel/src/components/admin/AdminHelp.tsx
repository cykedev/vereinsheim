"use client"

import { useState } from "react"

import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"
import { Sheet } from "@vereinsheim/ui/design2/sheet"

import { ADMIN_HELP, type AdminHelpId } from "@/lib/admin/help"

/** ein „?“ wie in der App, das die Erklärung eines Begriffs im Admin als Blatt öffnet */
export function AdminHelp({ id }: { id: AdminHelpId }) {
  const [open, setOpen] = useState(false)
  const help = ADMIN_HELP[id]
  return (
    <>
      <HelpButton label={help.title} helpId={`admin-${id}`} onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title={help.title}>
        <p data-admin-help={id} className="text-[15px] leading-relaxed text-foreground-2">
          {help.text}
        </p>
      </Sheet>
    </>
  )
}
