"use client"

import { cn } from "@vereinsheim/lib/utils"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

import { RouteLink } from "./RouteLink"
import type { CardRoute, Route } from "./routes"

export interface CardContextBarProps {
  /** wohin der Rückweg führt (`backRoute`) */
  back: Route
  /** sein Name (`backLabel`): „Scheiben“, „Letzte 90 Tage“, „Start“ */
  backText: string
  /** die ältere und die neuere Scheibe des Kontexts (`contextCardIds`, `neighbours`, `siblingRoute`) */
  prev: CardRoute | null
  next: CardRoute | null
  /** false: kein Kontext zum Blättern (direkter Link) */
  paging?: boolean
  className?: string
}

const STEP =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] leading-none font-semibold"

/**
 * Über dem Kopf der Scheibe: links der Rückweg mit dem Namen des Kontexts, rechts
 * „‹ vorige · nächste ›“ in zeitlicher Folge; vorige ist die ältere. Am Ende ausgegraut, ohne Adresse. Kein Wischen,
 * es kollidiert mit Zoom und Ausschnitt der Scheibe.
 */
export function CardContextBar({
  back,
  backText,
  prev,
  next,
  paging = true,
  className,
}: CardContextBarProps) {
  const step = (route: CardRoute | null, which: "prev" | "next") => {
    const content =
      which === "prev" ? (
        <>
          <ChevronLeft aria-hidden="true" className="size-4" />
          vorige
        </>
      ) : (
        <>
          nächste
          <ChevronRight aria-hidden="true" className="size-4" />
        </>
      )
    return route ? (
      <RouteLink
        route={route}
        aria-label={which === "prev" ? "Vorige Scheibe" : "Nächste Scheibe"}
        data-pager={which}
        className={cn(
          STEP,
          "cursor-pointer text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
        )}
      >
        {content}
      </RouteLink>
    ) : (
      // ohne Ziel ein gesperrter Link ohne Adresse: so sagen Screenreader ihn an (ein <span> mit aria-disabled nicht)
      <a
        role="link"
        aria-disabled="true"
        aria-label={which === "prev" ? "Vorige Scheibe" : "Nächste Scheibe"}
        data-pager={which}
        className={cn(STEP, "text-muted-foreground")}
      >
        {content}
      </a>
    )
  }

  return (
    <nav
      aria-label="Scheibe im Kontext"
      data-card-context
      className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}
    >
      <RouteLink
        route={back}
        aria-label={`Zurück zu „${backText}“`}
        className="-ml-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] leading-none font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backText}
      </RouteLink>
      {paging && (
        <div className="-mr-2.5 flex items-center gap-1">
          {step(prev, "prev")}
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          {step(next, "next")}
        </div>
      )}
    </nav>
  )
}
