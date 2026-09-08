"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"

interface Props {
  href: string
  label?: string
}

// Inline-ghost-Aktion für die Detail-Aktionsleiste: Icon immer, Label ab sm.
// Das Icon ist `Download` (Icon-Vokabular §4: PDF/Download).
export function PdfDownloadButton({ href, label = "PDF exportieren" }: Props) {
  const [loading, setLoading] = useState(false)

  function handleClick() {
    setLoading(true)
    window.open(href, "_blank")
    setTimeout(() => setLoading(false), 2500)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="px-2 sm:px-3"
      onClick={handleClick}
      disabled={loading}
      aria-label={label}
    >
      <Download className="h-4 w-4 sm:mr-1.5" />
      <span className="hidden sm:inline">{loading ? "Erstelle PDF…" : label}</span>
    </Button>
  )
}
