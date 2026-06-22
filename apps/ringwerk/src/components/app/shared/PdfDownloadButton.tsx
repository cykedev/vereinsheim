"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  href: string
  label?: string
}

export function PdfDownloadButton({ href, label = "PDF exportieren" }: Props) {
  const [loading, setLoading] = useState(false)

  function handleClick() {
    setLoading(true)
    window.open(href, "_blank")
    setTimeout(() => setLoading(false), 2500)
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10"
      onClick={handleClick}
      disabled={loading}
      title={loading ? "Erstelle PDF…" : label}
    >
      <FileDown className="h-4 w-4" />
    </Button>
  )
}
