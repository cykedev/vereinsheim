"use client"

import { ArrowLeft, BookOpen, ChevronRight, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { useNavigationConfirm } from "@vereinsheim/lib/hooks/useNavigationConfirm"
import { useUnsavedChangesGuard } from "@vereinsheim/lib/hooks/useUnsavedChangesGuard"
import { markShots, type CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { MiniTarget } from "@vereinsheim/shot-ui/target/MiniTarget"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"

import { ActionRow } from "@/components/card/ActionRow"

import { goalDiscard } from "../consequences"
import { saveGoalNote, saveGoalOutcome } from "../goals/actions"
import { goalHeadMeta, goalPhaseText } from "../goals/labels"
import type { GoalView } from "../goals/queries"
import { basisLine, bigNumber, standTiles, thresholdText } from "../goals/stand-text"
import { GOAL_TEXTS } from "../goals/texts"
import type { EntrySummary } from "../queries"
import { dayLabel, entryLine, entryTitle } from "../summaries"

import { DeleteGoal } from "./DeleteGoal"
import { EntryText } from "./EntryText"
import { GoalChart } from "./GoalChart"
import { GoalState } from "./GoalList"
import { OutcomeChoice } from "./OutcomeChoice"
import { ROW_BUTTON } from "./styles"

const BOX = "rounded-2xl border border-border bg-card p-4"
const LINK =
  "text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
/** so viele Einträge stehen zuerst, die übrigen hinter „Alle … zeigen“ */
const FIRST_ENTRIES = 5

/** eine Zeile mit „+“, die etwas festlegt (Disziplin, Messung, Notiz), gebaut wie ein leerer Abschnitt */
function PlusRow({
  title,
  hint,
  href,
  onClick,
  name,
}: {
  title: string
  hint: string
  href?: string
  onClick?: () => void
  name: string
}) {
  const plus =
    "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
  return (
    <div data-plus-row={name} className="flex items-center justify-between gap-3">
      <span className="grid min-w-0">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      {href ? (
        <Link href={href} aria-label={title} className={plus}>
          <Plus aria-hidden className="size-4" />
        </Link>
      ) : (
        <button type="button" aria-label={title} onClick={onClick} className={plus}>
          <Plus aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Die Seite eines Ziels, für jedes Ziel gleich gebaut: Stand, Notiz, „Hat es geklappt?“, Einträge im Zeitraum, „Dieses
 * Ziel“. Nur der Inhalt von „Stand“ hängt davon ab, ob Spiegel misst. Spiegel zeigt Zahlen, die Antwort gibt der
 * Schütze.
 */
export function GoalScreen({
  goal,
  marks,
  timeZone,
}: {
  goal: GoalView
  marks: Record<string, CardMark[]>
  timeZone: string
}) {
  const router = useRouter()
  const [dirty, setDirty] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [allEntries, setAllEntries] = useState(false)
  const onDirty = useCallback((_: string, isDirty: boolean) => setDirty(isDirty), [])
  useUnsavedChangesGuard({ enabled: dirty })
  const leave = useNavigationConfirm({ isDirty: dirty })
  const edit = `/diary/goals/${goal.id}/edit`
  const entries = allEntries ? goal.entryList : goal.entryList.slice(0, FIRST_ENTRIES)

  return (
    <Page>
      <section data-goal-page className={`grid gap-5 ${PAGE_SINGLE}`}>
        <Link
          href="/diary/goals"
          onClick={(event) => {
            if (!dirty) return
            event.preventDefault()
            leave.requestNavigation(() => router.push("/diary/goals"))
          }}
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {GOAL_TEXTS.back}
        </Link>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            {goal.title}
          </h1>
          <p className="text-foreground-2 tabular-nums">{goalHeadMeta(goal, timeZone)}</p>
        </div>

        <GoalStand goal={goal} edit={edit} timeZone={timeZone} />

        <div data-goal-note className={`${BOX} grid gap-1`}>
          {goal.note === null && !noteOpen ? (
            <PlusRow
              name="note"
              title={GOAL_TEXTS.note}
              hint={GOAL_TEXTS.noteEmpty}
              onClick={() => setNoteOpen(true)}
            />
          ) : (
            <EntryText
              name="note"
              label={GOAL_TEXTS.note}
              placeholder={GOAL_TEXTS.noteEmpty}
              value={goal.note}
              rows={3}
              save={(text) => saveGoalNote(goal.id, text)}
              savedText={GOAL_TEXTS.noteSaved}
              onDirty={onDirty}
            />
          )}
        </div>

        <div className={BOX}>
          <OutcomeChoice
            id={goal.id}
            value={goal.outcome}
            save={(next) => saveGoalOutcome(goal.id, next)}
            hint={GOAL_TEXTS.outcomeHint}
          />
        </div>

        <section
          data-goal-entries
          aria-labelledby="goal-entries-title"
          className={`${BOX} grid gap-2`}
        >
          <h2 id="goal-entries-title" className="text-[15px] font-semibold">
            {GOAL_TEXTS.entries}
          </h2>
          {goal.entryList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{GOAL_TEXTS.noEntries}</p>
          ) : (
            <ul className="grid divide-y divide-border">
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} marks={marks} timeZone={timeZone} />
              ))}
            </ul>
          )}
          {!allEntries && goal.entryList.length > FIRST_ENTRIES && (
            <button
              type="button"
              onClick={() => setAllEntries(true)}
              className={`${LINK} cursor-pointer justify-self-start`}
            >
              {GOAL_TEXTS.allEntries(goal.entryList.length)}
            </button>
          )}
        </section>

        <section data-goal-actions aria-labelledby="goal-actions-title" className={BOX}>
          <h2 id="goal-actions-title" className="mb-3 text-[15px] font-semibold">
            {GOAL_TEXTS.thisGoal}
          </h2>
          <div className="grid divide-y divide-border">
            <ActionRow
              title={goal.kind === "result" ? GOAL_TEXTS.basicsResult : GOAL_TEXTS.basicsProcess}
              state=""
              action={
                <Link href={edit} className={ROW_BUTTON}>
                  {GOAL_TEXTS.change}
                </Link>
              }
            />
            <DeleteGoal goalId={goal.id} title={goal.title} />
          </div>
        </section>
      </section>
      <DecisionDialog
        decision={goalDiscard()}
        open={leave.isConfirmOpen}
        onOpenChange={(open) => !open && leave.cancel()}
        onConfirm={leave.confirm}
      />
    </Page>
  )
}

/** der Kasten „Stand“: ohne Disziplin, ohne Messung oder mit den Zahlen der Messung */
function GoalStand({ goal, edit, timeZone }: { goal: GoalView; edit: string; timeZone: string }) {
  const { rule, stand } = goal
  const big = rule && stand ? bigNumber(rule, stand) : null
  const tiles = rule && stand ? standTiles(rule, stand, (day) => dayLabel(day, timeZone)) : null
  const basis = stand ? basisLine(stand) : null
  return (
    <section data-goal-stand aria-labelledby="goal-stand-title" className={`${BOX} grid gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="goal-stand-title" className="text-[15px] font-semibold">
          {GOAL_TEXTS.stand}
        </h2>
        <GoalState text={goalPhaseText(goal, timeZone)} running={goal.phase.phase === "running"} />
      </div>
      {!goal.family && (
        <PlusRow
          name="family"
          title={GOAL_TEXTS.setFamily}
          hint={GOAL_TEXTS.setFamilyHint}
          href={edit}
        />
      )}
      {goal.family && goal.kind === "result" && !rule && (
        <PlusRow
          name="measure"
          title={GOAL_TEXTS.setMeasure}
          hint={GOAL_TEXTS.setMeasureHint}
          href={edit}
        />
      )}
      {goal.kind === "process" && (
        <p className="text-sm text-foreground-2">{GOAL_TEXTS.processHint}</p>
      )}
      {rule && stand && (
        <div className="grid gap-3 @container">
          {goal.phase.phase === "upcoming" ? (
            <p className="text-sm text-foreground-2">
              {GOAL_TEXTS.beforeStart(dayLabel(goal.from, timeZone))}
            </p>
          ) : big ? (
            <div className="grid gap-3 @min-[34rem]:grid-cols-2 @min-[34rem]:items-center">
              <div className="grid gap-3">
                <p data-goal-big className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-[2.6rem] leading-none font-extrabold tabular-nums">
                    {big.value}
                  </span>
                  <span className="text-[15px] font-semibold text-muted-foreground">
                    {big.caption}
                  </span>
                </p>
                {tiles && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      [tiles.recent, GOAL_TEXTS.recent],
                      [tiles.best.value, GOAL_TEXTS.best(tiles.best.day)],
                      [tiles.mean, GOAL_TEXTS.mean],
                    ].map(([value, label]) => (
                      <div key={label} className="grid rounded-xl bg-surface-2 px-2.5 py-2">
                        <span className="font-display text-lg font-bold tabular-nums">{value}</span>
                        <span className="text-[12px] text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <GoalChart
                points={stand.points}
                threshold={rule.threshold}
                thresholdLabel={thresholdText(rule.threshold, rule.scoring)}
                timeZone={timeZone}
              />
            </div>
          ) : (
            <p className="text-sm text-foreground-2">{GOAL_TEXTS.noCard}</p>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            {basis && <span className="text-[12px] text-muted-foreground">{basis}</span>}
            {goal.progressHref && (
              <Link href={goal.progressHref} className={`${LINK} ml-auto`}>
                {GOAL_TEXTS.toProgress}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/** ein Eintrag im Zeitraum wie in der Liste des Tagebuchs: kleine Scheibe, Vorhaben, Tag und Scheiben */
function EntryRow({
  entry,
  marks,
  timeZone,
}: {
  entry: EntrySummary
  marks: Record<string, CardMark[]>
  timeZone: string
}) {
  const family = entry.family?.name ?? null
  const first = entry.cards[0]
  return (
    <li>
      <Link
        href={`/diary/${entry.id}`}
        data-goal-entry={entry.id}
        className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 py-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {first?.targetId ? (
          <MiniTarget
            target={TARGETS[first.targetId]}
            shots={markShots(marks[first.id] ?? [])}
            placeholder={(marks[first.id] ?? []).length === 0}
            className="size-9"
          />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
            <BookOpen aria-hidden className="size-4" />
          </span>
        )}
        <span className="grid min-w-0">
          <span className="truncate text-sm font-semibold">
            {entryTitle({ intention: entry.intention, family, kind: entry.kind })}
          </span>
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {entryLine({ ...entry, family }, timeZone)}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </Link>
    </li>
  )
}
