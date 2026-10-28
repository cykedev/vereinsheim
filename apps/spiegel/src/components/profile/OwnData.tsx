"use client"

import { Download, Trash2 } from "lucide-react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog, NoticeDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import { ActionRow } from "@/components/card/ActionRow"
import { ACCOUNT_TEXTS, accountDelete } from "@/lib/admin/consequences"
import { deleteOwnAccount } from "@/parts/account-actions"

const LINK =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"

/**
 * Kasten „Deine Daten“ im Profil ([[adr-033]] „Export und Löschen umfassen beide Teile“): alle Daten als eine Datei und
 * das Konto löschen. Ist es das einzige aktive Admin-Konto, sagt ein Hinweis warum es nicht geht, statt zu fragen. Die
 * Rückfrage nimmt das Passwort; stimmt es nicht, öffnet sie wieder mit dem Fehler am Feld.
 */
export function OwnData({ email, lastAdmin }: { email: string; lastAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <section
      data-own-data
      aria-labelledby="own-data-title"
      className="rounded-2xl border border-border bg-card p-4"
    >
      <h2 id="own-data-title" className="mb-3 text-[15px] font-semibold">
        {ACCOUNT_TEXTS.title}
      </h2>
      <div className="grid divide-y divide-border">
        <ActionRow
          data-own-data-export
          title={ACCOUNT_TEXTS.download}
          state={ACCOUNT_TEXTS.downloadText}
          action={
            <a href="/api/account/export" download className={LINK}>
              <Download aria-hidden className="size-4" />
              {ACCOUNT_TEXTS.download}
            </a>
          }
        />
        <ActionRow
          data-own-data-delete
          title={ACCOUNT_TEXTS.delete}
          state={ACCOUNT_TEXTS.deleteText}
          action={
            <button
              type="button"
              disabled={pending}
              onClick={() => (lastAdmin ? setNotice(true) : setOpen(true))}
              className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              <Trash2 aria-hidden className="size-4" />
              {pending ? "Konto löschen…" : ACCOUNT_TEXTS.delete}
            </button>
          }
        />
      </div>
      <DecisionDialog
        decision={accountDelete({ email })}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // beim Bestätigen hat die Action das Passwort schon: Der Knopf ruft sie, bevor der Dialog schließt
          if (!next) {
            setPassword("")
            setError(null)
          }
        }}
        confirmDisabled={!password}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteOwnAccount(password)
            if ("error" in result) {
              const message = getErrorMessage(result) ?? ACCOUNT_TEXTS.failed
              if (message === ACCOUNT_TEXTS.lastAdmin) {
                setNotice(true)
                return
              }
              setError(message)
              setOpen(true)
              return
            }
            await signOut({ redirect: false })
            router.replace("/login")
            router.refresh()
          })
        }
      >
        <OwnDataPassword password={password} onChange={setPassword} error={error} />
      </DecisionDialog>
      <NoticeDialog
        title={ACCOUNT_TEXTS.lastAdminTitle}
        text={ACCOUNT_TEXTS.lastAdmin}
        open={notice}
        onOpenChange={setNotice}
      />
    </section>
  )
}

/** das Feld „Dein Passwort“ in der Rückfrage, mit dem Fehler darunter; getrennt, damit ein Markup-Test es sieht */
export function OwnDataPassword({
  password,
  onChange,
  error,
}: {
  password: string
  onChange: (password: string) => void
  error: string | null
}) {
  const aria = error
    ? { "aria-invalid": true as const, "aria-describedby": "own-data-password-error" }
    : {}
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="own-data-password">{ACCOUNT_TEXTS.password}</Label>
      <Input
        id="own-data-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => onChange(event.target.value)}
        {...aria}
      />
      {error && (
        <p id="own-data-password-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
