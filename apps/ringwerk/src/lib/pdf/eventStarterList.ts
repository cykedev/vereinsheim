export interface StarterListInputParticipant {
  status: "ACTIVE" | "WITHDRAWN"
  participant: { firstName: string; lastName: string }
  discipline: { name: string } | null
}

export interface StarterListRow {
  nr: number
  firstName: string
  lastName: string
  disciplineName: string | null
}

interface BuildArgs {
  participants: StarterListInputParticipant[]
  competitionDisciplineName: string | null
  random: () => number
}

/**
 * Filters ACTIVE participants, sorts by lastName/firstName, then assigns
 * a Fisher–Yates–shuffled start number 1..n to each sorted row.
 *
 * The list is alphabetically ordered but the Nr. column is randomised,
 * so the starting order is not predictable from the name order.
 *
 * `random` injection makes the shuffle deterministic in tests.
 */
export function buildStarterListRows({
  participants,
  competitionDisciplineName,
  random,
}: BuildArgs): StarterListRow[] {
  const active = participants
    .filter((p) => p.status === "ACTIVE")
    .sort((a, b) => {
      const last = a.participant.lastName.localeCompare(b.participant.lastName, "de")
      if (last !== 0) return last
      return a.participant.firstName.localeCompare(b.participant.firstName, "de")
    })

  // Build a shuffled pool of numbers 1..n
  const n = active.length
  const numbers = Array.from({ length: n }, (_, i) => i + 1)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[numbers[i], numbers[j]] = [numbers[j], numbers[i]]
  }

  return active.map((cp, idx) => ({
    nr: numbers[idx],
    firstName: cp.participant.firstName,
    lastName: cp.participant.lastName,
    disciplineName: cp.discipline?.name ?? competitionDisciplineName ?? null,
  }))
}
