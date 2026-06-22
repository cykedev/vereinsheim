"use client"

import type { ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import type { ScoringType } from "@/generated/prisma/client"
import { getRingsInputProps } from "@/lib/series/scoring-format"

interface Props extends Omit<
  ComponentProps<typeof Input>,
  "inputMode" | "step" | "placeholder" | "min" | "max"
> {
  scoringType: ScoringType
  shotsPerSeries: number
}

/**
 * Input for rings values — sets inputMode, step, placeholder and max
 * based on the effective ScoringType of the current context.
 */
export function RingsInput({ scoringType, shotsPerSeries, ...rest }: Props) {
  const { inputMode, placeholder, step, min, max } = getRingsInputProps(scoringType, shotsPerSeries)
  return (
    <Input
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      {...rest}
    />
  )
}
