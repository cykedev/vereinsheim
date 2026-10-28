"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState, type ReactNode } from "react"

import { useNavigationConfirm } from "@vereinsheim/lib/hooks/useNavigationConfirm"
import { useUnsavedChangesGuard } from "@vereinsheim/lib/hooks/useUnsavedChangesGuard"
import { formatValue } from "@vereinsheim/shot-ui/format"
import type { CardMark } from "@vereinsheim/shot-core/projection"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"

import { saveEntryText, saveExpected } from "../actions"
import { diaryDiscard } from "../consequences"
import type { EntryView, Family } from "../queries"
import type { ScalePart } from "../scales"
import { entryMeta, KIND_WORDS, resultText } from "../summaries"
import { ENTRY_TEXTS } from "../texts"

import { EntryBasics } from "./EntryBasics"
import { EntryCards } from "./EntryCards"
import { EntrySection } from "./EntrySection"
import { EntryText } from "./EntryText"
import { ExecutionSection } from "./ExecutionSection"
import { OutcomeChoice } from "./OutcomeChoice"
import { ScaleSection } from "./ScaleSection"
import { ThreadHint } from "./ThreadHint"

const BOX = "rounded-2xl border border-border bg-card p-4"
const H2 = "font-display text-xl font-bold tracking-tight"

const valuesOf = (entry: EntryView, part: ScalePart) =>
  Object.fromEntries(entry.scales.filter((s) => s.part === part).map((s) => [s.aspect, s.value]))

/**
 * Die Seite eines Eintrags ([[adr-033]]): Scheiben, Vorhaben, Notiz, darunter Vorher und Nachher. Jeder Abschnitt
 * folgt einer festen Regel (leer eine Zeile mit „+“, gefüllt offen), Stufen speichern beim Tippen, Texte mit
 * „Speichern“. Ungespeicherte Texte hält der Wächter beim Verlassen fest.
 */
export function EntryScreen({
  entry,
  marks,
  families,
  dayLabel,
  threadDayLabel,
  timeZone,
  actions,
}: {
  entry: EntryView
  marks: Record<string, CardMark[]>
  families: Family[]
  /** der Tag des Eintrags („Fr 13.03.“) */
  dayLabel: string
  /** der Tag der Frage im Faden */
  threadDayLabel: string | null
  timeZone: string
  /** weitere Zeilen im Kasten „Dieser Eintrag“ (Löschen) */
  actions?: ReactNode
}) {
  const router = useRouter()
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set())
  const onDirty = useCallback(
    (name: string, isDirty: boolean) =>
      setDirty((current) => {
        if (current.has(name) === isDirty) return current
        const next = new Set(current)
        if (isDirty) next.add(name)
        else next.delete(name)
        return next
      }),
    []
  )
  useUnsavedChangesGuard({ enabled: dirty.size > 0 })
  const leave = useNavigationConfirm({ isDirty: dirty.size > 0 })

  const ownCards = [
    ...entry.cards.linked.flatMap(({ card }) => (card ? [card] : [])),
    ...entry.cards.added,
  ]
  const executions: Record<string, number> = {}
  for (const e of entry.executions) executions[e.cardId] = (executions[e.cardId] ?? 0) + 1
  const shot = ownCards.length === 1 && ownCards[0].result ? resultText(ownCards[0].result) : null
  const prognosis = valuesOf(entry, "prognosis")
  const text =
    (field: "intention" | "note" | "learned" | "question" | "disturbed") => (value: string) =>
      saveEntryText(entry.id, field, value)

  return (
    <Page>
      <section data-entry-page className={`grid gap-5 ${PAGE_SINGLE}`}>
        <Link
          href="/diary"
          onClick={(event) => {
            if (dirty.size === 0) return
            event.preventDefault()
            leave.requestNavigation(() => router.push("/diary"))
          }}
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {ENTRY_TEXTS.back}
        </Link>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            {dayLabel}
          </h1>
          <p className="text-foreground-2">
            {entryMeta({
              family: entry.family?.name ?? null,
              kind: entry.kind,
              competition: entry.competition,
            })}
          </p>
        </div>

        {entry.kind === "shooting" && (
          <EntryCards
            entryId={entry.id}
            cards={entry.cards}
            marks={marks}
            executions={executions}
            dayLabel={dayLabel}
            timeZone={timeZone}
          />
        )}

        <div data-intention className="grid gap-1 rounded-2xl bg-accent-wash px-4 py-3">
          <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            {ENTRY_TEXTS.intention}
          </span>
          <EntryText
            name="intention"
            placeholder={ENTRY_TEXTS.intentionEmpty}
            value={entry.intention}
            rows={1}
            save={text("intention")}
            savedText={ENTRY_TEXTS.intentionSaved}
            onDirty={onDirty}
          />
        </div>

        <EntryText
          name="note"
          placeholder={ENTRY_TEXTS.noteEmpty}
          value={entry.note}
          rows={4}
          save={text("note")}
          savedText={ENTRY_TEXTS.noteSaved}
          onDirty={onDirty}
        />

        <div className="grid gap-3">
          <h2 className={H2}>{ENTRY_TEXTS.before}</h2>
          {entry.thread && threadDayLabel && (
            <ThreadHint
              entryId={entry.id}
              thread={entry.thread}
              dayLabel={threadDayLabel}
              canTake={!entry.intention}
            />
          )}
          <ScaleSection
            entryId={entry.id}
            day={dayLabel}
            part="wellbeing"
            values={valuesOf(entry, "wellbeing")}
          />
          <ScaleSection
            entryId={entry.id}
            day={dayLabel}
            part="prognosis"
            values={prognosis}
            filledBy={entry.expectedScore !== null}
          >
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm font-semibold">{ENTRY_TEXTS.expected}</span>
              <span className="flex items-start gap-2 text-sm">
                <EntryText
                  name="expected"
                  placeholder="340"
                  value={
                    entry.expectedScore === null
                      ? null
                      : formatValue(entry.expectedScore, 1).replace(/,0$/, "")
                  }
                  inputMode="decimal"
                  save={(value) => saveExpected(entry.id, value)}
                  savedText={ENTRY_TEXTS.saved}
                  onDirty={onDirty}
                />
                <span className="pt-2">{ENTRY_TEXTS.rings}</span>
              </span>
            </div>
          </ScaleSection>
        </div>

        <div className="grid gap-3">
          <h2 className={H2}>{ENTRY_TEXTS.after}</h2>
          <div className={`${BOX} grid gap-4`}>
            {/* gefragt mit Vorhaben; eine gespeicherte Antwort bleibt sichtbar, auch wenn das Vorhaben geleert ist */}
            {(entry.intention || entry.outcome) && (
              <OutcomeChoice entryId={entry.id} value={entry.outcome} />
            )}
            <EntryText
              name="learned"
              label={ENTRY_TEXTS.learned}
              placeholder={ENTRY_TEXTS.learnedEmpty}
              value={entry.learned}
              save={text("learned")}
              savedText={ENTRY_TEXTS.saved}
              onDirty={onDirty}
            />
            <EntryText
              name="question"
              label={ENTRY_TEXTS.question}
              placeholder={ENTRY_TEXTS.questionEmpty}
              value={entry.question}
              save={text("question")}
              savedText={ENTRY_TEXTS.saved}
              onDirty={onDirty}
            />
          </div>
          <EntrySection
            entryId={entry.id}
            section="disturbed"
            title={ENTRY_TEXTS.disturbed}
            hint={ENTRY_TEXTS.disturbedHint}
            day={dayLabel}
            filled={entry.disturbed !== null}
          >
            <EntryText
              name="disturbed"
              placeholder={ENTRY_TEXTS.disturbedHint}
              value={entry.disturbed}
              save={text("disturbed")}
              savedText={ENTRY_TEXTS.saved}
              onDirty={onDirty}
              className="pt-1"
            />
          </EntrySection>
          <ScaleSection
            entryId={entry.id}
            day={dayLabel}
            part="feedback"
            values={valuesOf(entry, "feedback")}
            marks={prognosis}
          >
            {entry.expectedScore !== null && shot && (
              <p
                data-expected-shot
                className="mt-2 border-t border-border pt-3 text-sm tabular-nums"
              >
                {`Erwartet ${formatValue(entry.expectedScore, 1).replace(/,0$/, "")} ${ENTRY_TEXTS.rings} · geschossen ${shot}`}
              </p>
            )}
          </ScaleSection>
          {ownCards.some((card) => (entry.series[card.id] ?? []).length > 0) && (
            <ExecutionSection
              entryId={entry.id}
              day={dayLabel}
              cards={ownCards}
              series={entry.series}
              values={Object.fromEntries(
                entry.executions.map((e) => [`${e.cardId}|${e.series}`, e.value])
              )}
              timeZone={timeZone}
            />
          )}
        </div>

        <section data-entry-actions aria-labelledby="entry-actions-title" className={BOX}>
          <h2 id="entry-actions-title" className="mb-3 text-[15px] font-semibold">
            {ENTRY_TEXTS.thisEntry}
          </h2>
          <div className="grid divide-y divide-border">
            <EntryBasics
              entryId={entry.id}
              editable={entry.basicsEditable}
              summary={[
                dayLabel,
                entry.kind === "shooting" ? "Mit Scheiben" : KIND_WORDS[entry.kind],
                entry.family?.name,
              ]
                .filter(Boolean)
                .join(" · ")}
              day={entry.day}
              kind={entry.kind}
              familyId={entry.family?.id ?? null}
              families={families}
            />
            {actions}
          </div>
        </section>
      </section>
      <DecisionDialog
        decision={diaryDiscard()}
        open={leave.isConfirmOpen}
        onOpenChange={(open) => !open && leave.cancel()}
        onConfirm={leave.confirm}
      />
    </Page>
  )
}
