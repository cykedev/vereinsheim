import type { ComponentProps } from "react"

import { cn } from "@vereinsheim/lib/utils"

import * as Base from "../ui/card"

// Die Karte in den Maßen von Design 2 (wie Spiegels Karten): 16 px Rand, 12 px zwischen Kopf und Inhalt, große
// Radien, Titel in 15 px. Dieselben Teile wie `ui/card`; eine Klasse am Aufruf gewinnt weiter (tailwind-merge).

function Card({ className, ...props }: ComponentProps<"div">) {
  return <Base.Card className={cn("gap-3 rounded-2xl py-4", className)} {...props} />
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <Base.CardHeader className={cn("gap-1 px-4 [.border-b]:pb-4", className)} {...props} />
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return <Base.CardTitle className={cn("text-[15px] leading-snug", className)} {...props} />
}

function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return <Base.CardDescription className={cn("text-[13px]", className)} {...props} />
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <Base.CardContent className={cn("px-4", className)} {...props} />
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <Base.CardFooter className={cn("px-4 [.border-t]:pt-4", className)} {...props} />
}

const { CardAction } = Base

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
