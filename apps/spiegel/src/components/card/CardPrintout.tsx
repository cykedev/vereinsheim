"use client"

import { Download } from "lucide-react"

import { formatTimeOfDay, formatWeekdayDate } from "@vereinsheim/lib/format"

import type { CardFetchInfo } from "@/lib/fetch-card/queries"

import { ActionRow } from "./ActionRow"

const LINK =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"

/** „gedruckt Di 27.10.2026 um 19:52“; ohne Druckzeit nichts */
const printedText = (printedAtMs: number | null, timeZone: string) => {
  if (printedAtMs === null) return null
  const at = new Date(printedAtMs)
  return `gedruckt ${formatWeekdayDate(at, timeZone)} um ${formatTimeOfDay(at, timeZone)}`
}

function PdfLink({ id }: { id: string }) {
  return (
    <a
      data-printout-file
      href={`/api/printouts/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noopener"
      className={LINK}
    >
      <Download aria-hidden className="size-4" />
      PDF öffnen
    </a>
  )
}

/** leiser Grund, wenn Spiegel die Werte eines Ausdrucks nicht übernehmen konnte */
export const UNREADABLE_VALUES = "Werte nicht lesbar"

function Unreadable() {
  return (
    <span data-printout-unreadable className="font-normal text-muted-foreground">
      {` · ${UNREADABLE_VALUES}`}
    </span>
  )
}

/**
 * Ausdruck als Zeile im Kasten „Diese Scheibe“: die ID wie im Fuß des Ausdrucks, damit Papier und Scheibe
 * zusammenfinden, mit Druckzeit und dem PDF; weitere Ausdrucke darunter. Konnte Spiegel die Werte eines Ausdrucks nicht
 * übernehmen (Scheibe vom Ausdruck ohne Brücke), steht leise „Werte nicht lesbar“ daneben. Ohne PDF (getippte ID, Scheibe der Brücke)
 * sagt die Zeile, wie es an die Scheibe kommt. Nicht auf der geteilten Seite: ID und Abend holen die Scheibe.
 */
export function CardPrintout({
  hex,
  printouts,
  timeZone,
}: {
  hex: string | null
  printouts: CardFetchInfo["printouts"]
  timeZone: string
}) {
  const [first, ...more] = printouts
  const firstPrinted = first ? printedText(first.printedAtMs, timeZone) : null
  return (
    <ActionRow
      data-card-printout
      {...(hex ? { "data-printed-id": hex } : {})}
      title="Ausdruck"
      state={
        <>
          <span className="font-semibold text-foreground">
            {[hex ? `ID ${hex}` : null, firstPrinted].filter(Boolean).join(" · ")}
            {first?.unreadable && <Unreadable />}
          </span>
          {!first && (
            <span className="block">
              Das PDF hängt an, wenn du den QR-Code unter „Scheibe holen“ scannst.
            </span>
          )}
        </>
      }
      action={first && <PdfLink id={first.id} />}
    >
      {more.length > 0 && (
        <ul className="grid gap-1">
          {more.map((printout) => (
            <li
              key={printout.id}
              data-printout-more
              className="flex flex-wrap items-center justify-between gap-x-4 text-[13px] text-muted-foreground"
            >
              <span>
                {["Weiterer Ausdruck", printedText(printout.printedAtMs, timeZone)]
                  .filter(Boolean)
                  .join(", ")}
                {printout.unreadable && <Unreadable />}
              </span>
              <PdfLink id={printout.id} />
            </li>
          ))}
        </ul>
      )}
    </ActionRow>
  )
}
