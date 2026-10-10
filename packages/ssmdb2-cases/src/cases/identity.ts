// Fälle zu Zeit, IDs und Namen: Uhrsprung, Uhr je Stand, Überlauf der ScheibenID, Platzhalter-Namen, „Trash“,
// gekappter Sportpass, nachgetragener Sportpass.

import { numbers } from "../expected"
import { MUSTER, scheibenIdAt } from "../stand"
import { defineCase, evening, idAt } from "./case"
import { fire, group, LG20, LP20, LP40, minutes, until } from "./helpers"

const SF30_START = evening(24, 9)
const SF30_ID = idAt(SF30_START)
/** die Uhr des Stands steht für die ersten drei Schüsse auf dem 9. Juli 2009 (so am 15. September 2026 beobachtet) */
const SF30_WRONG = Date.UTC(2009, 6, 9, 17, 0)

export const SF_30 = defineCase({
  id: "SF-30",
  title: "Uhrsprung mitten in der Scheibe",
  description:
    "LG 20: Die ersten drei Schüsse tragen den 9. Juli 2009, dann stimmt die Uhr des Stands wieder. Die Nummern folgen der Abgabe, die Zeit nicht.",
  start: SF30_START,
  run(sim) {
    const card = sim.card({ ...LG20, scheibenId: SF30_ID, standNr: 11 })
    const positions = group(20, 3001, 150)
    positions.slice(0, 3).forEach(([x, y], i) => {
      card.shot(1, x, y, { clock: SF30_WRONG + i * 45_000 })
      sim.advance(45_000)
    })
    fire(sim, card, 1, positions.slice(3))
    sim.read("20 Schuss, die ersten drei mit falscher Uhr")
  },
  expected: [
    {
      scheibenId: SF30_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: ["uhr-abweichung"],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Je Stellung zählt die Nummer, nicht die Zeit; der Widerspruch ergibt das Merkmal.",
        "Der Abstand von Schuss 3 zu 4 ist kein Intervall (Rücksprung der Uhr, `tempo`).",
      ],
    },
  ],
})

const SF73_START = evening(25, 9)
const SF73_ID = idAt(SF73_START)

export const SF_73 = defineCase({
  id: "SF-73",
  title: "Jeder Stand hat seine Uhr",
  description:
    "LP 40 an einem Stand, dessen Uhr 663 s nachgeht (so an Stand 20 beobachtet): Schüsse und Lebenszeichen tragen die Zeit des Stands.",
  start: SF73_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF73_ID, standNr: 20, clockOffsetMs: -663_000 })
    fire(sim, card, 1, group(40, 7301, 800))
    sim.read("40 Schuss, Uhr 11 Minuten zurück")
  },
  expected: [
    {
      scheibenId: SF73_ID,
      bridge: "senden",
      shots: [[0, 40]],
      flags: ["uhr-abweichung"],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 40) },
      notes: [
        "Versatz je Stand: Beobachtung minus Lebenszeichen, hier 663 s; ab einer Minute Merkmal.",
        "Abstände zwischen den Schüssen gelten; Datum und Uhrzeit nicht blind übernehmen.",
      ],
    },
  ],
})

/** der Zähler läuft so, dass die erste Scheibe kurz vor dem Überlauf liegt */
const SF77_START = evening(26, 9)
const SF77_BOOT = SF77_START - (2 ** 31 - minutes(5))
const SF77_A = scheibenIdAt(SF77_BOOT, SF77_START)
const SF77_B_AT = SF77_START + minutes(60)
const SF77_B = scheibenIdAt(SF77_BOOT, SF77_B_AT)

export const SF_77 = defineCase({
  id: "SF-77",
  title: "ScheibenID läuft über",
  description:
    "Zwei Scheiben an einem Abend: die erste kurz vor dem Überlauf des Millisekundenzählers (ID nahe 2³¹), die zweite danach mit negativer ID. Die neuere hat die kleinere ID.",
  start: SF77_START,
  run(sim) {
    const a = sim.card({ ...LP20, scheibenId: SF77_A, standNr: 3 })
    fire(sim, a, 1, group(20, 7701, 800))
    sim.read("erste Scheibe")
    until(sim, SF77_B_AT)
    const b = sim.card({ ...LP20, scheibenId: SF77_B, standNr: 3 })
    fire(sim, b, 1, group(20, 7702, 800))
    sim.read("zweite Scheibe nach dem Überlauf")
  },
  expected: [
    {
      scheibenId: SF77_A,
      bridge: "senden",
      shots: [
        [0, 20],
        [0, 20],
      ],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
    },
    {
      scheibenId: SF77_B,
      bridge: "senden",
      shots: [null, [0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Kein Wasserstand über die ID: Schlüssel ist Quelle, Epoche und ScheibenID; kehrt eine ID wieder, entscheidet der Fingerabdruck der Schüsse.",
      ],
    },
  ],
})

const SF13_START = evening(27, 9)
const SF13_FREE = idAt(SF13_START)
const SF13_UNKNOWN_AT = SF13_START + minutes(5)
const SF13_UNKNOWN = idAt(SF13_UNKNOWN_AT)

export const SF_13 = defineCase({
  id: "SF-13",
  title: "Ohne Starter",
  description:
    "Ein freier Stand mit dem Platzhalter „--frei--“ ohne Schuss und eine Scheibe „unknown, unknown“ in der Starterliste „Trash“, mit Sportpass und 20 Schuss (an der Vereinsanlage 112-mal).",
  start: SF13_START,
  run(sim) {
    sim.card({
      ...LP20,
      scheibenId: SF13_FREE,
      standNr: 12,
      person: {
        Nachname: "--frei--",
        Vorname: "",
        Geschlecht: "unknown",
        SportpassID: 0,
        Starterliste: "",
        StarterlistenID: 0,
        Rangliste: "",
        RanglistenID: 0,
      },
    })
    until(sim, SF13_UNKNOWN_AT)
    const unknown = sim.card({
      ...LP20,
      scheibenId: SF13_UNKNOWN,
      standNr: 13,
      person: {
        Nachname: "unknown",
        Vorname: "unknown",
        Geschlecht: "unknown",
        Starterliste: "Trash",
        StarterlistenID: 99,
      },
    })
    fire(sim, unknown, 1, group(20, 1301, 800))
    sim.read("freier Stand und unbekannter Schütze")
  },
  expected: [
    {
      scheibenId: SF13_FREE,
      bridge: "auslassen",
      reason: "ohne Treffer",
      shots: [[0, 0]],
      flags: [],
      completeness: "leer",
      counted: { stellung: 0, numbers: [] },
    },
    {
      scheibenId: SF13_UNKNOWN,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "„unknown“ ist kein Name: nie nach dem Namen filtern, nur Scheiben ohne Treffer auslassen; zugeordnet wird über den Sportpass.",
      ],
    },
  ],
})

const SF78_START = evening(28, 9)
const SF78_ID = idAt(SF78_START)

export const SF_78 = defineCase({
  id: "SF-78",
  title: "Starterliste „Trash“",
  description:
    "Ein gewöhnliches Training, das in der Starterliste „Trash“ steht (an der Vereinsanlage jede fünfte Scheibe), mit Namen und Sportpass.",
  start: SF78_START,
  run(sim) {
    const card = sim.card({
      ...LG20,
      scheibenId: SF78_ID,
      standNr: 14,
      person: {
        Starterliste: "Trash",
        StarterlistenID: 99,
        Vorname: "Erika",
        Geschlecht: "female",
      },
    })
    fire(sim, card, 1, group(20, 7801, 150))
    sim.read("Training in „Trash“")
  },
  expected: [
    {
      scheibenId: SF78_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: ["Nie nach der Starterliste filtern; zugeordnet wird über den Sportpass."],
    },
  ],
})

const SF35_START = evening(29, 9)
const SF35_A = idAt(SF35_START)
const SF35_B_AT = SF35_START + minutes(45)
const SF35_B = idAt(SF35_B_AT)
/** ein auf `int(11)` gekappter Sportpass */
const CAPPED = 2147483647

export const SF_35 = defineCase({
  id: "SF-35",
  title: "Gekappter Sportpass",
  description:
    "Zwei Schützen mit verschiedenen Namen und derselben SportpassID 2147483647: eine zu lange Nummer, gekappt auf das Maximum von `int(11)` (an der Vereinsanlage seit `bigint(20)` nicht mehr).",
  start: SF35_START,
  run(sim) {
    const a = sim.card({
      ...LP20,
      scheibenId: SF35_A,
      standNr: 15,
      person: { SportpassID: CAPPED },
    })
    fire(sim, a, 1, group(20, 3501, 800))
    until(sim, SF35_B_AT)
    const b = sim.card({
      ...LP20,
      scheibenId: SF35_B,
      standNr: 16,
      person: { SportpassID: CAPPED, Nachname: "Beispiel", Vorname: "Anna", Geschlecht: "female" },
    })
    fire(sim, b, 1, group(20, 3502, 800))
    sim.read("zwei Schützen, ein Sportpass")
  },
  expected: [SF35_A, SF35_B].map((scheibenId) => ({
    scheibenId,
    bridge: "auslassen" as const,
    reason:
      "SportpassID 2147483647 steht auf der Sperrliste (gekappt, mehrere Namen): keine Zuordnung per Opt-in, nur über den QR-Code",
    shots: [[0, 20] as const],
    flags: [],
    completeness: "vollstaendig" as const,
    counted: { stellung: 1 as const, numbers: numbers(1, 20) },
  })),
})

const SF36_START = evening(30, 9)
const SF36_OLD = idAt(SF36_START)
const SF36_NEW_AT = SF36_START + minutes(60)
const SF36_NEW = idAt(SF36_NEW_AT)

export const SF_36 = defineCase({
  id: "SF-36",
  title: "Sportpass nachgetragen",
  description:
    "Dieselbe Person zweimal an einem Abend: zuerst ohne SportpassID (0), nach dem Nachtragen mit. Die alte Scheibe behält ihre 0.",
  start: SF36_START,
  run(sim) {
    const old = sim.card({ ...LP20, scheibenId: SF36_OLD, standNr: 17, person: { SportpassID: 0 } })
    fire(sim, old, 1, group(20, 3601, 800))
    until(sim, SF36_NEW_AT)
    const now = sim.card({
      ...LP20,
      scheibenId: SF36_NEW,
      standNr: 17,
      person: { SportpassID: MUSTER.SportpassID },
    })
    fire(sim, now, 1, group(20, 3602, 800))
    sim.read("ohne und mit Sportpass")
  },
  expected: [
    {
      scheibenId: SF36_OLD,
      bridge: "auslassen",
      reason:
        "ohne Sportpass: rückwirkend nur mit Namensvorschlag und Bestätigung, oder über den QR-Code",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
    },
    {
      scheibenId: SF36_NEW,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
    },
  ],
})

export const IDENTITY_CASES = [SF_30, SF_73, SF_77, SF_13, SF_78, SF_35, SF_36]
