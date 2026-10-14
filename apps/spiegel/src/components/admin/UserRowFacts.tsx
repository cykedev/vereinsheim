import { formatDateOnly } from "@vereinsheim/lib/format"

import type { UserListItem } from "@/lib/users/queries"

/**
 * Zahlen eines Kontos in der Liste (P2e, D1, D3): wie viele Scheiben, der Tag der letzten, Wartende in „Offen“, und ein
 * Hinweis, wenn eine Zustimmung lange ohne jede Scheibe ist. Keine Ergebnisse, keine Disziplinen.
 */
export function UserRowFacts({
  user,
  timeZone,
}: {
  user: Pick<UserListItem, "cards" | "lastCardAt" | "waiting" | "quiet">
  timeZone: string
}) {
  const parts = [
    user.cards === 0
      ? "noch keine Scheibe"
      : `${user.cards === 1 ? "1 Scheibe" : `${user.cards} Scheiben`}${
          user.lastCardAt ? ` · zuletzt ${formatDateOnly(new Date(user.lastCardAt), timeZone)}` : ""
        }`,
    user.waiting > 0
      ? user.waiting === 1
        ? "1 wartet in Offen"
        : `${user.waiting} warten in Offen`
      : null,
  ].filter(Boolean)
  return (
    <>
      <span data-user-cards>{parts.join(" · ")}</span>
      {user.quiet && (
        <span data-user-quiet className="text-warning">
          noch keine Scheibe seit der Bestätigung
        </span>
      )}
    </>
  )
}
