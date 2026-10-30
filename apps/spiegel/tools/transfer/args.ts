// Die Argumente von `tools/transfer.ts`, rein: null, wenn der Aufruf nicht passt (Exit-Code 2).

export interface TransferArgs {
  from: string
  to: string
  dryRun: boolean
  /** der Ordner mit den Dateien aus Treffsicher; null ohne `--files` */
  files: string | null
  families: { name: string; slug: string }[]
  /** `--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"`, je Name einmal */
  disciplines: { name: string; target: string }[]
}

const FLAGS_WITH_VALUE = new Set(["--from", "--to", "--files", "--family", "--discipline"])

/** `"<links>=<rechts>"`, geteilt am letzten `=`; null, wenn eine Seite leer ist */
function pairOf(raw: string): [string, string] | null {
  const at = raw.lastIndexOf("=")
  const left = raw.slice(0, at).trim()
  const right = raw.slice(at + 1).trim()
  return at === -1 || !left || !right ? null : [left, right]
}

export function argsOf(argv: readonly string[]): TransferArgs | null {
  const values: Record<string, string[]> = {}
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === "--dry-run") {
      dryRun = true
      continue
    }
    if (!FLAGS_WITH_VALUE.has(flag)) return null
    const value = argv[i + 1]
    if (value === undefined || value.startsWith("--") || !value.trim()) return null
    values[flag] = [...(values[flag] ?? []), value]
    i += 1
  }
  const one = (flag: string) => (values[flag]?.length === 1 ? values[flag][0].trim() : null)
  const from = one("--from")
  const to = one("--to")
  if (!from || !to) return null
  if ((values["--files"]?.length ?? 0) > 1) return null
  const families: TransferArgs["families"] = []
  for (const raw of values["--family"] ?? []) {
    const pair = pairOf(raw)
    if (!pair) return null
    families.push({ name: pair[0], slug: pair[1] })
  }
  const disciplines: TransferArgs["disciplines"] = []
  for (const raw of values["--discipline"] ?? []) {
    const pair = pairOf(raw)
    if (!pair) return null
    disciplines.push({ name: pair[0], target: pair[1] })
  }
  return { from, to, dryRun, files: one("--files"), families, disciplines }
}
