"use client"

import { usePathname } from "next/navigation"

import { Button } from "@vereinsheim/ui/button"

import { AREAS } from "@/components/app/shell/areas"
import { MOVED_TEXTS } from "@/lib/moved/texts"

/** der Knopf „Zu Spiegel“, im selben Tab; ohne Adresse keiner */
function ToSpiegel({ spiegelUrl }: { spiegelUrl: string | null }) {
  if (!spiegelUrl) return null
  return (
    <Button asChild size="sm" className="shrink-0 justify-self-start">
      <a href={spiegelUrl} data-moved-link>
        {MOVED_TEXTS.toSpiegel}
      </a>
    </Button>
  )
}

/**
 * Hinweis oben auf jeder Seite eines Kontos, das nach Spiegel umgezogen ist ([[adr-033]], Stufe 3). Voll auf Start,
 * dort landet jede Anmeldung; auf allen anderen Seiten eine Zeile. Aufbau, Ort, Farbe und Knopf sind überall gleich.
 */
export function MovedBanner({ full, spiegelUrl }: { full: boolean; spiegelUrl: string | null }) {
  if (full) {
    return (
      <section
        data-moved-banner="full"
        aria-label="Hinweis"
        className="grid gap-2 rounded-2xl border border-line-strong bg-accent-wash p-4 text-sm"
      >
        <p className="text-[15px] font-semibold">{MOVED_TEXTS.bannerTitle}</p>
        <p className="text-foreground-2">{MOVED_TEXTS.bannerText}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ToSpiegel spiegelUrl={spiegelUrl} />
          <span className="text-[13px] text-muted-foreground">{MOVED_TEXTS.signIn}</span>
        </div>
      </section>
    )
  }
  return (
    <section
      data-moved-banner="short"
      aria-label="Hinweis"
      className="grid gap-2 rounded-2xl border border-line-strong bg-accent-wash p-4 text-sm sm:flex sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="font-semibold">{MOVED_TEXTS.bannerShort}</p>
      <ToSpiegel spiegelUrl={spiegelUrl} />
    </section>
  )
}

/** der Hinweis mit dem Inhalt, der zur gezeigten Seite passt */
export function MovedBannerHost({ spiegelUrl }: { spiegelUrl: string | null }) {
  const full = usePathname() === AREAS.start.href
  return <MovedBanner full={full} spiegelUrl={spiegelUrl} />
}
