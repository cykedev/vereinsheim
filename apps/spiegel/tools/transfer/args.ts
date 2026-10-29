// Die Argumente von `tools/transfer.ts`, rein: null, wenn der Aufruf nicht passt (Exit-Code 2).

export interface TransferArgs {
  from: string
  to: string
  dryRun: boolean
  /** der Ordner mit den Dateien aus Treffsicher; null ohne `--files` */
  files: string | null
  families: { name: string; slug: string }[]
}

const FLAGS_WITH_VALUE = new Set(["--from", "--to", "--files", "--family"])

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
    const at = raw.lastIndexOf("=")
    const name = raw.slice(0, at).trim()
    const slug = raw.slice(at + 1).trim()
    if (at === -1 || !name || !slug) return null
    families.push({ name, slug })
  }
  return { from, to, dryRun, files: one("--files"), families }
}
