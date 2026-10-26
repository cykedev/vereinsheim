// Abgleich der Konten von Treffsicher und Spiegel vor der Übernahme ([[adr-033]], Stufe 3): Konten ordnen sich über die
// E-Mail zu. Wo keine gleiche E-Mail passt, nennen Name und Teile der Adresse einen Verdacht, den ein Mensch prüft.
// Dazu das Format der Zuordnung (`from,to,status,reason`), das der Bericht schreibt und die Übernahme Konto für Konto
// liest. Reine Funktionen ohne Datenbank: Die Konten kommen als CSV je App (ADR-002, keine Verbindung zwischen den
// Datenbanken).

/** Ein Konto aus Treffsicher, Spalten wie `scripts/transfer/treffsicher-accounts.sql`. */
export interface TreffsicherAccount {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
  createdAt: string
  sessions: number
  sessionsWithResult: number
  lastSession: string | null
  favourites: number
  ownDisciplines: number
  goals: number
  routines: number
}

/** Ein Konto aus Spiegel, Spalten wie `scripts/transfer/spiegel-accounts.sql`. */
export interface SpiegelAccount {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  cards: number
  lastCard: string | null
  /** letzter Stand der Zustimmung per Sportpass, null ohne */
  consent: string | null
}

/** Was in einem Paar mit gleicher E-Mail abweicht. */
export type PairDifference = "role" | "active"

/**
 * Warum ein Spiegel-Konto vermutlich dieselbe Person ist: gleicher Name, ähnlicher Name (Abstand höchstens 2, ab
 * sechs Zeichen), gleicher Teil vor dem @ bei anderer Domain, gleicher Teil vor dem @ mit fast gleicher Domain
 * (Abstand höchstens 2, ein Tippfehler oder eine verwandte Domain desselben Anbieters).
 */
export type SuspicionReason = "name" | "name-similar" | "local-part" | "domain-typo"

export interface AccountPair {
  treffsicher: TreffsicherAccount
  spiegel: SpiegelAccount
  differences: PairDifference[]
}

export interface SuspicionCandidate {
  spiegel: SpiegelAccount
  reasons: SuspicionReason[]
}

export interface Suspicion {
  treffsicher: TreffsicherAccount
  candidates: SuspicionCandidate[]
}

export interface AccountMatch {
  both: AccountPair[]
  suspected: Suspicion[]
  onlyTreffsicher: TreffsicherAccount[]
  onlySpiegel: SpiegelAccount[]
}

const MIN_SIMILAR_NAME = 6
const MAX_NAME_DISTANCE = 2
const MAX_DOMAIN_DISTANCE = 2

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Wörter eines Namens in ihrer Reihenfolge: klein, Umlaute und ß ausgeschrieben (auch zerlegt geschriebene, NFC).
function nameWords(name: string | null): string[] {
  if (!name) return []
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .split(/\s+/)
    .filter((word) => word !== "")
}

/** Klein, Umlaute und ß ausgeschrieben, Wörter sortiert: „Groß Jürgen“ und „Juergen Gross“ sind gleich. */
export function normalizeName(name: string | null): string {
  return nameWords(name).sort().join(" ")
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
    }
    previous = current
  }
  return previous[b.length]
}

function emailParts(email: string): { local: string; domain: string } {
  const normalized = normalizeEmail(email)
  const at = normalized.lastIndexOf("@")
  if (at < 0) return { local: normalized, domain: "" }
  return { local: normalized.slice(0, at), domain: normalized.slice(at + 1) }
}

function suspicionReasons(
  treffsicher: TreffsicherAccount,
  spiegel: SpiegelAccount
): SuspicionReason[] {
  const reasons: SuspicionReason[] = []
  const a = normalizeName(treffsicher.name)
  const b = normalizeName(spiegel.name)
  if (a !== "" && a === b) reasons.push("name")
  else if (a !== "" && b !== "" && Math.min(a.length, b.length) >= MIN_SIMILAR_NAME) {
    // Sortiert fängt vertauschte Wörter, in der Reihenfolge einen Tippfehler am Anfang eines Worts, der die
    // Sortierung ändert („Hans Zimmer“, „Hans Gimmer“).
    const inOrder = levenshtein(
      nameWords(treffsicher.name).join(" "),
      nameWords(spiegel.name).join(" ")
    )
    if (Math.min(levenshtein(a, b), inOrder) <= MAX_NAME_DISTANCE) reasons.push("name-similar")
  }

  const x = emailParts(treffsicher.email)
  const y = emailParts(spiegel.email)
  if (x.local !== "" && x.local === y.local) {
    reasons.push(
      levenshtein(x.domain, y.domain) <= MAX_DOMAIN_DISTANCE ? "domain-typo" : "local-part"
    )
  }
  return reasons
}

// Die Fehlermeldung nennt nur die Zahl, keine Adresse: Sie landet auf der Konsole.
function assertUniqueEmails(accounts: { email: string }[], app: string): void {
  const emails = new Set(accounts.map((account) => normalizeEmail(account.email)))
  const duplicates = accounts.length - emails.size
  if (duplicates > 0) {
    throw new Error(
      `${duplicates} Konten in ${app} teilen sich eine E-Mail mit einem anderen (ohne Groß- und Kleinschreibung)`
    )
  }
}

function byEmail<T extends { email: string }>(a: T, b: T): number {
  const x = normalizeEmail(a.email)
  const y = normalizeEmail(b.email)
  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * Ordnet jedes Treffsicher-Konto genau einer Gruppe zu: Paar über die gleiche E-Mail, Verdacht (Spiegel-Konten ohne
 * Partner, die über Name oder Adresse passen) oder nur in Treffsicher. Spiegel-Konten ohne Partner und ohne Verdacht
 * stehen in `onlySpiegel`. Ein über die E-Mail vergebenes Spiegel-Konto ist nie zusätzlich ein Verdacht.
 */
export function matchAccounts(
  treffsicher: TreffsicherAccount[],
  spiegel: SpiegelAccount[]
): AccountMatch {
  assertUniqueEmails(treffsicher, "Treffsicher")
  assertUniqueEmails(spiegel, "Spiegel")
  const spiegelByEmail = new Map(spiegel.map((account) => [normalizeEmail(account.email), account]))
  const both: AccountPair[] = []
  const unmatched: TreffsicherAccount[] = []
  const claimed = new Set<string>()

  for (const account of [...treffsicher].sort(byEmail)) {
    const partner = spiegelByEmail.get(normalizeEmail(account.email))
    if (!partner) {
      unmatched.push(account)
      continue
    }
    claimed.add(partner.id)
    const differences: PairDifference[] = []
    if (account.role !== partner.role) differences.push("role")
    if (account.isActive !== partner.isActive) differences.push("active")
    both.push({ treffsicher: account, spiegel: partner, differences })
  }

  const free = spiegel.filter((account) => !claimed.has(account.id)).sort(byEmail)
  const suspected: Suspicion[] = []
  const onlyTreffsicher: TreffsicherAccount[] = []
  const suspects = new Set<string>()

  for (const account of unmatched) {
    const candidates = free
      .map((candidate) => ({ spiegel: candidate, reasons: suspicionReasons(account, candidate) }))
      .filter((candidate) => candidate.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length || byEmail(a.spiegel, b.spiegel))
    if (candidates.length === 0) {
      onlyTreffsicher.push(account)
      continue
    }
    for (const candidate of candidates) suspects.add(candidate.spiegel.id)
    suspected.push({ treffsicher: account, candidates })
  }

  const onlySpiegel = free.filter((account) => !suspects.has(account.id))
  return { both, suspected, onlyTreffsicher, onlySpiegel }
}

// ── CSV ──────────────────────────────────────────────────────────────────────

interface CsvRecord {
  /** Zeile in der Datei, in der der Datensatz beginnt (1 = Kopfzeile) */
  line: number
  fields: string[]
}

/** CSV nach RFC 4180 mit Kopfzeile (wie `psql --csv`); BOM, CRLF und leere Zeilen sind erlaubt. */
function csvRecords(text: string): CsvRecord[] {
  const input = text.startsWith("﻿") ? text.slice(1) : text
  const records: CsvRecord[] = []
  let fields: string[] = []
  let field = ""
  let quoted = false
  // das Feld war in Anführungszeichen und ist geschlossen: danach darf nur Komma oder Zeilenende kommen
  let closed = false
  let line = 1
  let start = 1
  const endRecord = () => {
    fields.push(field)
    if (!(fields.length === 1 && fields[0] === "")) records.push({ line: start, fields })
    fields = []
    field = ""
    closed = false
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
        closed = true
      } else {
        if (char === "\n") line++
        field += char
      }
    } else if (char === ",") {
      fields.push(field)
      field = ""
      closed = false
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++
      endRecord()
      line++
      start = line
    } else if (closed) {
      throw new Error(`Zeile ${line}: nach dem schließenden Anführungszeichen fehlt das Komma`)
    } else if (char === '"' && field === "") {
      quoted = true
    } else {
      // ein Anführungszeichen mitten im Feld ohne Anführungszeichen außen herum gilt als Zeichen
      field += char
    }
  }
  if (quoted) throw new Error(`Zeile ${start}: Anführungszeichen nicht geschlossen`)
  if (field !== "" || fields.length > 0) endRecord()
  return records
}

function recordsWithHeader(text: string): { header: string[]; rows: CsvRecord[] } {
  const [head, ...rows] = csvRecords(text)
  if (!head) throw new Error("Kopfzeile fehlt")
  for (const row of rows) {
    if (row.fields.length !== head.fields.length) {
      throw new Error(`Zeile ${row.line}: ${row.fields.length} statt ${head.fields.length} Felder`)
    }
  }
  return { header: head.fields, rows }
}

/** Liest eine CSV mit Kopfzeile in Objekte nach Spaltennamen. */
export function parseCsv(text: string): Record<string, string>[] {
  const { header, rows } = recordsWithHeader(text)
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row.fields[i]])))
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// ── Konten aus der CSV der Abfragen ──────────────────────────────────────────

const TREFFSICHER_COLUMNS = [
  "id",
  "name",
  "email",
  "role",
  "is_active",
  "created_at",
  "sessions",
  "sessions_with_result",
  "last_session",
  "favourites",
  "own_disciplines",
  "goals",
  "routines",
]

const SPIEGEL_COLUMNS = [
  "id",
  "name",
  "email",
  "role",
  "is_active",
  "must_change_password",
  "created_at",
  "cards",
  "last_card",
  "consent",
]

// Die Spalten koppeln SQL und Parser: Fehlt eine, wären Zählungen still 0 und Konten still inaktiv.
function accountRows(csv: string, columns: string[]): Record<string, string>[] {
  const { header, rows } = recordsWithHeader(csv)
  const missing = columns.find((column) => !header.includes(column))
  if (missing) throw new Error(`Spalte „${missing}“ fehlt`)
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row.fields[i]])))
}

function text(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value
}

function count(value: string | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) ? n : 0
}

// `psql --csv` schreibt Wahrheitswerte als t und f.
function flag(value: string | undefined): boolean {
  return value === "t" || value === "true"
}

export function treffsicherAccountsFromCsv(csv: string): TreffsicherAccount[] {
  return accountRows(csv, TREFFSICHER_COLUMNS).map((row) => ({
    id: row.id,
    name: text(row.name),
    email: row.email,
    role: row.role,
    isActive: flag(row.is_active),
    createdAt: row.created_at,
    sessions: count(row.sessions),
    sessionsWithResult: count(row.sessions_with_result),
    lastSession: text(row.last_session),
    favourites: count(row.favourites),
    ownDisciplines: count(row.own_disciplines),
    goals: count(row.goals),
    routines: count(row.routines),
  }))
}

export function spiegelAccountsFromCsv(csv: string): SpiegelAccount[] {
  return accountRows(csv, SPIEGEL_COLUMNS).map((row) => ({
    id: row.id,
    name: text(row.name),
    email: row.email,
    role: row.role,
    isActive: flag(row.is_active),
    mustChangePassword: flag(row.must_change_password),
    createdAt: row.created_at,
    cards: count(row.cards),
    lastCard: text(row.last_card),
    consent: text(row.consent),
  }))
}

// ── Zuordnung für die Übernahme ──────────────────────────────────────────────

/** `ok`: gleiche E-Mail; `check`: Verdacht, ein Mensch entscheidet; `new`: das Konto entsteht bei der Übernahme. */
export type MappingStatus = "ok" | "check" | "new"

/** Eine Zeile der Zuordnung: Treffsicher-Konto `from` geht an das Spiegel-Konto `to` (je E-Mail). */
export interface MappingRow {
  from: string
  to: string
  status: MappingStatus
  reason: string
}

export const MAPPING_HEADER = ["from", "to", "status", "reason"] as const
const MAPPING_STATUSES: readonly MappingStatus[] = ["ok", "check", "new"]

export const REASON_LABELS: Record<SuspicionReason, string> = {
  name: "gleicher Name",
  "name-similar": "ähnlicher Name",
  "local-part": "gleicher Teil vor dem @",
  "domain-typo": "gleicher Teil vor dem @, Domain fast gleich",
}

/** Der Vorschlag: eine Zeile je Treffsicher-Konto, bei einem Verdacht eine je Kandidat; nach `from` sortiert. */
export function proposeMapping(match: AccountMatch): MappingRow[] {
  const rows: MappingRow[] = [
    ...match.both.map((pair): MappingRow => ({
      from: pair.treffsicher.email,
      to: pair.spiegel.email,
      status: "ok",
      reason: "",
    })),
    ...match.suspected.flatMap((suspicion) =>
      suspicion.candidates.map((candidate): MappingRow => ({
        from: suspicion.treffsicher.email,
        to: candidate.spiegel.email,
        status: "check",
        reason: candidate.reasons.map((reason) => REASON_LABELS[reason]).join(", "),
      }))
    ),
    ...match.onlyTreffsicher.map((account): MappingRow => ({
      from: account.email,
      to: account.email,
      status: "new",
      reason: "",
    })),
  ]
  // stabil: die Kandidaten eines Kontos behalten ihre Reihenfolge
  return rows.sort((a, b) => byEmail({ email: a.from }, { email: b.from }))
}

export function formatMappingCsv(rows: MappingRow[]): string {
  const lines = [MAPPING_HEADER.join(",")]
  for (const row of rows) lines.push(MAPPING_HEADER.map((name) => csvField(row[name])).join(","))
  return lines.join("\n") + "\n"
}

/** Liest eine (auch von Hand bearbeitete) Zuordnung; ein Fehler nennt die Zeile in der Datei. */
export function parseMappingCsv(csv: string): MappingRow[] {
  const { header, rows } = recordsWithHeader(csv)
  if (header.map((name) => name.trim()).join(",") !== MAPPING_HEADER.join(",")) {
    throw new Error(`Kopfzeile muss „${MAPPING_HEADER.join(",")}“ sein`)
  }
  return rows.map(({ line, fields }) => {
    const [from, to, status, reason] = fields.map((field) => field.trim())
    if (from === "" || to === "") throw new Error(`Zeile ${line}: from und to brauchen eine E-Mail`)
    if (!MAPPING_STATUSES.includes(status as MappingStatus)) {
      throw new Error(`Zeile ${line}: Status „${status}“ ist nicht ${MAPPING_STATUSES.join(", ")}`)
    }
    return { from, to, status: status as MappingStatus, reason }
  })
}
