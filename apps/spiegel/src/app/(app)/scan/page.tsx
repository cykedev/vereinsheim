import type { Metadata } from "next"

import { Placeholder } from "@/components/shell/Placeholder"

export const metadata: Metadata = { title: "QR scannen" }

export default function ScanRoute() {
  return (
    <Placeholder
      title="QR scannen"
      sentence="Scannen kommt mit der Zuordnung über den Meyton-QR: Vorschau, Bestätigen, dann die Seite der neuen Scheibe."
    />
  )
}
