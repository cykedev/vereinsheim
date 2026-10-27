/** „–“ für eine Zahl ohne Wert, mit ihrem Grund als Tooltip und für Screenreader; ohne Grund nur der Strich */
export function Dash({ reason }: { reason?: string | null }) {
  if (!reason) return <>–</>
  return (
    <span title={reason}>
      –<span className="sr-only">{` ${reason}`}</span>
    </span>
  )
}
