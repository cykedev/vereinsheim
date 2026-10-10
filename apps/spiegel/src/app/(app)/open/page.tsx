import type { Metadata } from "next"

import { Placeholder } from "@/components/shell/Placeholder"

export const metadata: Metadata = { title: "Offen" }

export default function OpenRoute() {
  return (
    <Placeholder
      title="Offen"
      sentence="Hier stehen Dinge, die auf dich warten (erste Scheibe bestätigen, ein wartender QR-Scan). Sie kommen mit der Zuordnung (SP-1.7)."
    />
  )
}
