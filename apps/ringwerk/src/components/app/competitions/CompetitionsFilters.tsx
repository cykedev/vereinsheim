"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vereinsheim/ui/select"

type Option = {
  value: string
  label: string
}

interface Props {
  statusOptions: Option[]
  typeOptions: Option[]
  disciplineOptions: Option[]
  selectedStatus: string
  selectedType: string
  selectedDiscipline: string
}

export function CompetitionsFilters({
  statusOptions,
  typeOptions,
  disciplineOptions,
  selectedStatus,
  selectedType,
  selectedDiscipline,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const hasActiveFilters =
    selectedStatus !== "all" || selectedType !== "all" || selectedDiscipline !== "all"

  function updateFilters(nextStatus: string, nextType: string, nextDiscipline: string): void {
    const params = new URLSearchParams(searchParams.toString())

    if (nextStatus === "all") params.delete("status")
    else params.set("status", nextStatus)

    if (nextType === "all") params.delete("type")
    else params.set("type", nextType)

    if (nextDiscipline === "all") params.delete("discipline")
    else params.set("discipline", nextDiscipline)

    const query = params.toString()
    startTransition(() => {
      // replace statt push: Filterwechsel soll keine neue Browser-History pro Klick erzeugen.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  function resetFilters(): void {
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Select
        value={selectedStatus}
        onValueChange={(value) => updateFilters(value, selectedType, selectedDiscipline)}
        disabled={isPending}
      >
        <SelectTrigger className="h-9 w-full sm:w-[160px]">
          <SelectValue placeholder="Alle Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Status</SelectItem>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedType}
        onValueChange={(value) => updateFilters(selectedStatus, value, selectedDiscipline)}
        disabled={isPending}
      >
        <SelectTrigger className="h-9 w-full sm:w-[160px]">
          <SelectValue placeholder="Alle Typen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Typen</SelectItem>
          {typeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedDiscipline}
        onValueChange={(value) => updateFilters(selectedStatus, selectedType, value)}
        disabled={isPending}
      >
        <SelectTrigger className="h-9 w-full sm:w-[220px]">
          <SelectValue placeholder="Alle Disziplinen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Disziplinen</SelectItem>
          {disciplineOptions.map((discipline) => (
            <SelectItem key={discipline.value} value={discipline.value}>
              {discipline.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Filter zurücksetzen"
          onClick={resetFilters}
          disabled={isPending}
          className="h-9 w-9 self-end sm:self-auto"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
