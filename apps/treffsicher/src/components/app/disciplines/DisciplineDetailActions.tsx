import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"

import type { Discipline } from "@/generated/prisma/client"
import { ArchiveDisciplineButton } from "@/components/app/disciplines/ArchiveDisciplineButton"
import { DeleteDisciplineButton } from "@/components/app/disciplines/DeleteDisciplineButton"
import { FavouriteDisciplineButton } from "@/components/app/disciplines/FavouriteDisciplineButton"
import { HideDisciplineButton } from "@/components/app/disciplines/HideDisciplineButton"
import { disciplineActivate, disciplineArchive, disciplineDelete } from "@/lib/consequences"
import { Button } from "@vereinsheim/ui/button"
import { DetailActionBar } from "@vereinsheim/ui/shell/DetailActionBar"

interface Props {
  discipline: Discipline
  /** Konto nach Spiegel umgezogen: kein Favorit und kein Ausblenden mehr */
  moved: boolean
  /** bearbeiten und archivieren (`disciplineWritable` und Rolle, von der Seite berechnet) */
  canManage: boolean
  canDelete: boolean
  favourite: boolean
  hidden: boolean
}

/** die Aktionen einer Disziplin: Einstellungen des Kontos, dann Bearbeiten, Archivieren, Löschen, Zurück */
export function DisciplineDetailActions({
  discipline,
  moved,
  canManage,
  canDelete,
  favourite,
  hidden,
}: Props) {
  return (
    <DetailActionBar>
      {!moved && !discipline.isArchived && (
        <FavouriteDisciplineButton disciplineId={discipline.id} initialFavourite={favourite} />
      )}
      {!moved && !discipline.isArchived && (
        <HideDisciplineButton disciplineId={discipline.id} initialHidden={hidden} />
      )}
      {canManage && (
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/disciplines/${discipline.id}/edit`} aria-label="Disziplin bearbeiten">
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {canManage && (
        <ArchiveDisciplineButton
          disciplineId={discipline.id}
          isArchived={discipline.isArchived}
          decision={
            discipline.isArchived
              ? disciplineActivate({ name: discipline.name, system: discipline.isSystem })
              : disciplineArchive({
                  name: discipline.name,
                  system: discipline.isSystem,
                  favourite,
                })
          }
        />
      )}
      {canManage && canDelete && (
        <DeleteDisciplineButton
          disciplineId={discipline.id}
          decision={disciplineDelete({ name: discipline.name, system: discipline.isSystem })}
        />
      )}
      <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
        <Link href="/disciplines" aria-label="Zurück zu Disziplinen">
          <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Zurück</span>
        </Link>
      </Button>
    </DetailActionBar>
  )
}
