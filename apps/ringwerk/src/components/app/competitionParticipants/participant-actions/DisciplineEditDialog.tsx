import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { ParticipantActionsState } from "./useParticipantActions"

interface Props {
  actions: ParticipantActionsState
  fullName: string
  disciplines: SerializableDiscipline[]
  currentDisciplineId: string | null
}

export function DisciplineEditDialog({
  actions,
  fullName,
  disciplines,
  currentDisciplineId,
}: Props) {
  const {
    isPending,
    disciplineOpen,
    setDisciplineOpen,
    selectedDisciplineId,
    setSelectedDisciplineId,
    handleDisciplineSave,
  } = actions

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Disziplin ändern"
        onClick={() => {
          setSelectedDisciplineId(currentDisciplineId ?? "")
          setDisciplineOpen(true)
        }}
        disabled={isPending}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={disciplineOpen} onOpenChange={setDisciplineOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disziplin ändern</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{fullName}</p>
          <div className="space-y-1.5">
            <Label htmlFor="discipline-select">Disziplin</Label>
            <Select
              value={selectedDisciplineId}
              onValueChange={setSelectedDisciplineId}
              disabled={isPending}
            >
              <SelectTrigger id="discipline-select">
                <SelectValue placeholder="Disziplin wählen…" />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisciplineOpen(false)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button onClick={handleDisciplineSave} disabled={isPending || !selectedDisciplineId}>
              {isPending ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
