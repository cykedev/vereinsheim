import type { Metadata } from "next"

import { Placeholder } from "@/components/shell/Placeholder"

export const metadata: Metadata = { title: "Fortschritt" }

export default function ProgressRoute() {
  return (
    <Placeholder
      title="Fortschritt"
      sentence="Der Fortschritt kommt als Nächstes: Verlauf mit Formband, Umfang, Vergleich und Rekorde, aus der Projektion je Scheibe (SP-1.8)."
    />
  )
}
