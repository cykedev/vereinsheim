"use client"

import type { ReactNode } from "react"

import { cn } from "@vereinsheim/lib/utils"

interface ToggleChipProps {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  /** kleines Symbol vor dem Text (14 px) */
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/** Schalter-Chip (Design 2): ein Ein/Aus für eine Ebene, etwa Schwerpunkt, Streukreis oder Nummern */
export function ToggleChip({
  pressed,
  onPressedChange,
  icon,
  children,
  className,
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-[7px] rounded-full border border-line-strong py-1.5 pr-[11px] pl-2 text-[12.5px] leading-none font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent-wash aria-pressed:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
    >
      {icon}
      {children}
    </button>
  )
}
