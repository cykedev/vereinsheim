"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { formatWeekdayDate, zonedDayStartMs } from "@vereinsheim/lib/format"
import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { Button } from "@vereinsheim/ui/button"
import { Page } from "@vereinsheim/ui/design2/page"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import type { CardKind } from "@/generated/prisma/enums"
import { fetchCardById, fetchCardByLink, fetchCardByUpload } from "@/lib/fetch-card/actions"
import type { LegacyRequest, NewCardChoice, NewCardOption } from "@/lib/fetch-card/queries"
import { fetchErrorText, fetchToast, type FetchOutcome } from "@/lib/fetch-card/texts"
import type { ActionResult } from "@/lib/types"

import { CameraScan } from "./CameraScan"
import { LegacyRequests } from "./LegacyRequests"
import { NewCardSheet } from "./NewCardSheet"

/** die Wege, eine Scheibe zu holen; die Kamera liefert einen Link */
type Way = "camera" | "link" | "upload" | "id"

/** was die Seite noch einmal schickt, wenn das Blatt „Neue Scheibe“ die Wahl hat */
type Source =
  | { way: "camera" | "link"; url: string }
  | { way: "upload"; file: File }
  | { way: "id"; id: string; day: string }

/** eine Karte je Weg: Titel, Satz, dann der Weg und sein Fehler */
function WayCard({
  way,
  title,
  sentence,
  error,
  children,
}: {
  way: Way
  title: string
  sentence?: string
  error: string | null
  children: ReactNode
}) {
  return (
    <section
      data-fetch-way={way}
      aria-labelledby={`fetch-${way}-title`}
      className="grid gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="grid gap-1">
        <h2 id={`fetch-${way}-title`} className="text-[15px] font-semibold">
          {title}
        </h2>
        {sentence && <p className="text-sm text-foreground-2">{sentence}</p>}
      </div>
      {children}
      {error && (
        <p role="alert" data-fetch-error className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

const READING = "Spiegel liest den Ausdruck…"
const LINK_MISSING = "Füge den Link aus dem QR-Code ein."

/** Vorbelegung des Blatts „Neue Scheibe“: die Disziplin aus dem Kopf des Ausdrucks vor der der letzten Scheibe */
export function sheetPreset(
  preset: { disciplineId: number | null; kind: CardKind },
  headerDisciplineId: number | null
): { disciplineId: number | null; kind: CardKind } {
  return { ...preset, disciplineId: headerDisciplineId ?? preset.disciplineId }
}

/**
 * Seite „Scheibe holen“: Kamera, Link, PDF und ID in dieser Folge, jeder Weg gleich. Liegt die Scheibe schon in Spiegel,
 * öffnet Spiegel sie; sonst fragt das Blatt „Neue Scheibe“ nach Disziplin und Art und schickt dieselbe Quelle noch
 * einmal. Jeder Weg hat sein eigenes „läuft“ und seinen eigenen Fehler. Darunter ältere Aufträge, solange es welche gibt.
 */
export function ScanScreen({
  options,
  preset,
  legacy,
  today,
  timeZone,
}: {
  options: readonly NewCardOption[]
  preset: { disciplineId: number | null; kind: CardKind }
  legacy: readonly LegacyRequest[]
  /** heute in der Anzeige-Zone (`YYYY-MM-DD`), Vorgabe und Grenze des Tags */
  today: string
  timeZone: string
}) {
  const router = useRouter()
  const [link, setLink] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const [id, setId] = useState("")
  const [day, setDay] = useState(today)
  const [errors, setErrors] = useState<Partial<Record<Way, string>>>({})
  const [idState, setIdState] = useState<ActionResult<FetchOutcome> | null>(null)
  const [sheet, setSheet] = useState<{
    source: Source
    idLine: string
    relifts: boolean
    /** die Disziplin aus dem Kopf des Ausdrucks; null: die der letzten Scheibe */
    disciplineId: number | null
    key: number
  } | null>(null)
  const [cameraPending, startCamera] = useTransition()
  const [linkPending, startLink] = useTransition()
  const [uploadPending, startUpload] = useTransition()
  const [idPending, startId] = useTransition()
  const start: Record<Way, (run: () => Promise<void>) => void> = {
    camera: startCamera,
    link: startLink,
    upload: startUpload,
    id: startId,
  }
  const pendingOf: Record<Way, boolean> = {
    camera: cameraPending,
    link: linkPending,
    upload: uploadPending,
    id: idPending,
  }
  const dayText = (iso: string) =>
    formatWeekdayDate(new Date(zonedDayStartMs(iso, timeZone)), timeZone)

  const call = (source: Source, choice: NewCardChoice | null) => {
    switch (source.way) {
      case "camera":
      case "link":
        return fetchCardByLink(source.url, choice)
      case "upload": {
        const form = new FormData()
        form.set("file", source.file)
        if (choice) {
          form.set("disciplineId", String(choice.disciplineId))
          form.set("kind", choice.kind)
        }
        return fetchCardByUpload(form)
      }
      case "id":
        return fetchCardById(source.id, source.day, choice)
    }
  }

  const submit = (source: Source, choice: NewCardChoice | null) =>
    start[source.way](async () => {
      setErrors((current) => ({ ...current, [source.way]: undefined }))
      if (source.way === "id") setIdState(null)
      // ein abgelehnter Aufruf (kein Netz am Stand, eine Datei über der Grenze der Anfrage, nach einem Deploy eine
      // unbekannte Action) wird zur Meldung am Weg; aus der Transition geworfen ersetzte er die ganze Seite
      let result: Awaited<ReturnType<typeof call>>
      try {
        result = await call(source, choice)
      } catch {
        setSheet(null)
        setErrors((current) => ({ ...current, [source.way]: fetchErrorText("failed") }))
        return
      }
      if ("error" in result) {
        setSheet(null)
        if (source.way === "id") setIdState(result)
        const general = getGeneralError(result)
        if (general) setErrors((current) => ({ ...current, [source.way]: general }))
        return
      }
      const outcome = result.data
      if (!outcome) return
      if (outcome.kind === "choose") {
        setSheet({
          source,
          idLine: `ID ${outcome.hex} vom ${dayText(outcome.day)}`,
          relifts: outcome.relifts,
          disciplineId: outcome.disciplineId,
          key: Date.now(),
        })
        return
      }
      setSheet(null)
      const text = fetchToast(outcome)
      if (text) toast.success(text)
      router.push(outcome.kind === "pending" ? "/open" : `/cards/${outcome.cardId}`)
    })

  const idError = getFieldError(idState, "id")
  const dayError = getFieldError(idState, "day")

  return (
    <Page>
      <section data-scan className={cn("grid gap-6", PAGE_SINGLE)}>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Scheibe holen
          </h1>
          <p className="text-foreground-2">
            Mit dem QR-Code, dem Link, dem PDF oder der ID vom Ausdruck. Liegt die Scheibe schon in
            Spiegel, öffnet Spiegel sie.
          </p>
        </div>

        <WayCard
          way="camera"
          title="QR-Code scannen"
          sentence="Halte die Kamera auf den QR-Code am Stand oder auf dem Ausdruck."
          error={errors.camera ?? null}
        >
          <CameraScan
            onLink={(url) => submit({ way: "camera", url }, null)}
            disabled={cameraPending}
          />
          {cameraPending && (
            <p role="status" className="text-sm text-foreground-2">
              {READING}
            </p>
          )}
        </WayCard>

        <WayCard way="link" title="Link einfügen" error={errors.link ?? null}>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              // ohne Link sagt der Knopf am Feld, was fehlt, statt gesperrt zu sein
              if (!link.trim()) {
                setLinkError(LINK_MISSING)
                return
              }
              setLinkError(null)
              submit({ way: "link", url: link }, null)
            }}
          >
            <div className="grid min-w-0 flex-1 basis-56 gap-1.5">
              <Label htmlFor="fetch-link">Link aus dem QR-Code</Label>
              <Input
                id="fetch-link"
                name="link"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="http://…"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                disabled={linkPending}
                {...(linkError
                  ? { "aria-invalid": true, "aria-describedby": "fetch-link-error" }
                  : {})}
              />
            </div>
            <Button type="submit" className="h-10" disabled={linkPending}>
              {linkPending ? "Holen…" : "Holen"}
            </Button>
          </form>
          <FieldError id="fetch-link-error" message={linkError ?? undefined} />
          {linkPending && (
            <p role="status" className="text-sm text-foreground-2">
              {READING}
            </p>
          )}
        </WayCard>

        <WayCard
          way="upload"
          title="PDF hochladen"
          sentence="Ein Ausdruck als PDF, etwa ein älterer."
          error={errors.upload ?? null}
        >
          <div>
            <input
              id="fetch-upload"
              name="file"
              type="file"
              accept="application/pdf"
              className="peer sr-only"
              disabled={uploadPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                // dieselbe Datei noch einmal wählen löst wieder ein `change` aus
                event.target.value = ""
                if (!file) return
                // zu groß geht gar nicht erst los: die Grenze der Anfrage läge vor der Action
                if (file.size > DEFAULT_LIMITS.maxBytes)
                  setErrors((current) => ({ ...current, upload: fetchErrorText("tooLarge") }))
                else submit({ way: "upload", file }, null)
              }}
            />
            <label
              htmlFor="fetch-upload"
              className="inline-flex h-10 cursor-pointer items-center rounded-full border border-line-strong px-4 text-sm font-semibold text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-default peer-disabled:opacity-60 hover:bg-accent-wash"
            >
              {uploadPending ? READING : "PDF wählen"}
            </label>
          </div>
        </WayCard>

        <WayCard
          way="id"
          title="ID eintippen"
          sentence="Die ID steht unten auf dem Ausdruck, etwa „ID: ff914420“."
          error={errors.id ?? null}
        >
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              submit({ way: "id", id, day }, null)
            }}
          >
            <div className="flex flex-wrap gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fetch-id">ID vom Ausdruck</Label>
                <Input
                  id="fetch-id"
                  name="id"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="ff914420"
                  className="w-44"
                  value={id}
                  onChange={(event) => setId(event.target.value)}
                  disabled={idPending}
                  {...(idError
                    ? { "aria-invalid": true, "aria-describedby": "fetch-id-error" }
                    : {})}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fetch-day">Tag der Scheibe</Label>
                <Input
                  id="fetch-day"
                  name="day"
                  type="date"
                  max={today}
                  className="w-44"
                  value={day}
                  onChange={(event) => setDay(event.target.value)}
                  disabled={idPending}
                  {...(dayError
                    ? { "aria-invalid": true, "aria-describedby": "fetch-day-error" }
                    : {})}
                />
              </div>
            </div>
            <FieldError id="fetch-id-error" message={idError} />
            <FieldError id="fetch-day-error" message={dayError} />
            <div>
              <Button type="submit" className="h-10" disabled={idPending}>
                {idPending ? "Holen…" : "Holen"}
              </Button>
            </div>
          </form>
        </WayCard>

        <LegacyRequests requests={legacy} timeZone={timeZone} />
      </section>

      {sheet && (
        <NewCardSheet
          key={sheet.key}
          open
          onClose={() => setSheet(null)}
          idLine={sheet.idLine}
          relifts={sheet.relifts}
          options={options}
          preset={sheetPreset(preset, sheet.disciplineId)}
          pending={pendingOf[sheet.source.way]}
          onCreate={(choice) => submit(sheet.source, choice)}
        />
      )}
    </Page>
  )
}
