// Fälle zu Zeit, IDs und Namen: Uhrsprung, Uhr je Stand, Überlauf der ScheibenID, Platzhalter-Namen, „Trash“,
// gekappter Sportpass, nachgetragener Sportpass.

import { numbers } from "../expected"
import { MUSTER, scheibenIdAt } from "../stand"
import { defineCase, evening, idAt } from "./case"
import { fire, group, LG20, LP20, LP40, minutes, until, wait } from "./helpers"

const SF30_START = evening(24, 9)
const SF30_ID = idAt(SF30_START)
/** die Uhr des Stands steht zu Beginn auf dem 9. Juli 2009 (so am 15. September 2026 an zwei Ständen beobachtet) */
const SF30_WRONG = Date.UTC(2009, 6, 9, 17, 0)

export const SF_30 = defineCase({
  id: "SF-30",
  title: "Uhrsprung mitten in der Scheibe",
  description:
    "LG 20: Die Uhr des Stands steht zu Beginn auf dem 9. Juli 2009, nach Schuss 3 springt sie auf die richtige Zeit vor. Kopfzeile und die ersten drei Schüsse tragen 2009.",
  start: SF30_START,
  run(sim) {
    const card = sim.card({
      ...LG20,
      scheibenId: SF30_ID,
      standNr: 11,
      clockOffsetMs: SF30_WRONG - SF30_START,
    })
    const positions = group(20, 3001, 150)
    fire(sim, card, 1, positions.slice(0, 3))
    card.setClockOffset(0)
    fire(sim, card, 1, positions.slice(3))
    sim.read("20 Schuss, die ersten drei mit falscher Uhr")
  },
  expected: [
    {
      scheibenId: SF30_ID,
      bridge: "senden",
      sentReadings: [1],
      shots: [[0, 20]],
      flags: ["uhr-abweichung"],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Datum der Schüsse 1 bis 3 um Jahre neben der Beobachtung: Merkmal; Reihenfolge je Stellung nach der Nummer.",
        "Der Abstand von Schuss 3 zu 4 (elf Jahre) ist kein Intervall und keine Pause.",
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
    sim.read("40 Schuss")
    wait(sim, card, 30_000)
    sim.read("Stand belegt, das Lebenszeichen läuft 11 Minuten hinter der Beobachtung")
  },
  expected: [
    {
      scheibenId: SF73_ID,
      bridge: "senden",
      sentReadings: [1, 2],
      shots: [
        [0, 40],
        [0, 40],
      ],
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
      sentReadings: [1],
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
      sentReadings: [2],
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
const SF13_FREE_SHOTS = idAt(SF13_START) + 1
const SF13_UNKNOWN_AT = SF13_START + minutes(20)
const SF13_UNKNOWN = idAt(SF13_UNKNOWN_AT)

export const SF_13 = defineCase({
  id: "SF-13",
  title: "Ohne Starter",
  description:
    "Ein freier Stand „--frei--“ ohne Schuss, einer mit 20 Schuss ohne Sportpass, und eine Scheibe „unknown, unknown“ in der Starterliste „Trash“ mit Sportpass und 20 Schuss (an der Vereinsanlage 112-mal; „--frei--“ dort nie).",
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
    const used = sim.card({
      ...LP20,
      scheibenId: SF13_FREE_SHOTS,
      standNr: 14,
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
    fire(sim, used, 1, group(20, 1302, 800))
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
      sentReadings: [],
      reason: "ohne Treffer",
      shots: [[0, 0]],
      flags: [],
      completeness: "leer",
      counted: { stellung: 0, numbers: [] },
    },
    {
      scheibenId: SF13_FREE_SHOTS,
      bridge: "nur-qr",
      sentReadings: [],
      reason: "„--frei--“ mit Schüssen, aber ohne Sportpass: nur über den QR-Code oder „Scheibe holen“",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: ["Nie nach dem Namen filtern: Auch „--frei--“ kann ein Training sein."],
    },
    {
      scheibenId: SF13_UNKNOWN,
      bridge: "senden",
      sentReadings: [1],
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
      sentReadings: [1],
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
const SF35_C_AT = SF35_START + minutes(90)
const SF35_C = idAt(SF35_C_AT)
const SF35_D_AT = SF35_START + minutes(135)
const SF35_D = idAt(SF35_D_AT)
/** ein auf `int(11)` gekappter Sportpass */
const CAPPED = 2147483647

export const SF_35 = defineCase({
  id: "SF-35",
  title: "Gekappter Sportpass",
  description:
    "Zwei Schützen mit derselben SportpassID 2147483647 (eine zu lange Nummer, gekappt auf das Maximum von `int(11)`; an der Vereinsanlage nie beobachtet, dort `bigint(20)`), und zwei Namen unter der zugestimmten Nummer 12345678.",
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
    until(sim, SF35_C_AT)
    const c = sim.card({ ...LP20, scheibenId: SF35_C, standNr: 15 })
    fire(sim, c, 1, group(20, 3503, 800))
    until(sim, SF35_D_AT)
    const d = sim.card({
      ...LP20,
      scheibenId: SF35_D,
      standNr: 16,
      person: { Nachname: "Beispiel", Vorname: "Anna", Geschlecht: "female" },
    })
    fire(sim, d, 1, group(20, 3504, 800))
    sim.read("gekappte Nummer und eine Nummer mit zwei Namen")
  },
  expected: [
    ...[SF35_A, SF35_B].map((scheibenId) => ({
      scheibenId,
      bridge: "nur-qr" as const,
      sentReadings: [],
      reason:
        "SportpassID 2147483647 steht auf der Sperrliste (gekappt): keine Zuordnung per Opt-in, nur über den QR-Code",
      shots: [[0, 20] as const],
      flags: [],
      completeness: "vollstaendig" as const,
      counted: { stellung: 1 as const, numbers: numbers(1, 20) },
    })),
    ...[SF35_C, SF35_D].map((scheibenId) => ({
      scheibenId,
      bridge: "senden" as const,
      sentReadings: [1],
      shots: [[0, 20] as const],
      flags: [],
      completeness: "vollstaendig" as const,
      counted: { stellung: 1 as const, numbers: numbers(1, 20) },
      notes: [
        "Dieselbe zugestimmte Nummer mit zwei Namen: Die Brücke schickt beide, Spiegel ordnet nicht automatisch zu und meldet es dem Admin.",
      ],
    })),
  ],
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
      bridge: "nur-qr",
      sentReadings: [],
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
      sentReadings: [1],
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
    },
  ],
})

const SF32_START = evening(23, 9)
const SF32_A = idAt(SF32_START)
const SF32_B = idAt(SF32_START) + 1
/** Schuss 20 an Stand 1 um …:05,900, an Stand 2 um …:06,100 (Uhr des Stands) */
const SF32_LAST = SF32_START + minutes(20)

export const SF_32 = defineCase({
  id: "SF-32",
  title: "Zeit als Paar, nicht als Summe",
  description:
    "Zwei Stände, der letzte Schuss an Stand 1 um 19:20:05,900, an Stand 2 um 19:20:06,100. Als Zahl gerechnet (`Zeitstempel + Millisekunden`) wirkt der an Stand 2 älter.",
  start: SF32_START,
  run(sim) {
    const a = sim.card({ ...LP20, scheibenId: SF32_A, standNr: 1 })
    const b = sim.card({ ...LP20, scheibenId: SF32_B, standNr: 2 })
    const [pa, pb] = [group(20, 3201, 800), group(20, 3202, 800)]
    for (let i = 0; i < 19; i++) {
      a.shot(1, ...pa[i])
      sim.advance(20_000 + i * 37)
      b.shot(1, ...pb[i])
      sim.advance(30_000 + i * 53)
    }
    a.shot(1, ...pa[19], { clock: SF32_LAST + 5_900 })
    b.shot(1, ...pb[19], { clock: SF32_LAST + 6_100 })
    until(sim, SF32_LAST + 40_000)
    sim.read("beide fertig")
  },
  expected: [SF32_A, SF32_B].map((scheibenId) => ({
    scheibenId,
    bridge: "senden" as const,
    sentReadings: [1],
    shots: [[0, 20] as const],
    flags: [],
    completeness: "vollstaendig" as const,
    counted: { stellung: 1 as const, numbers: numbers(1, 20) },
    notes: [
      "Zeitstempel und Millisekunden immer als Paar vergleichen: 19:20:06,100 ist neuer als 19:20:05,900.",
    ],
  })),
})

export const IDENTITY_CASES = [SF_30, SF_32, SF_73, SF_77, SF_13, SF_78, SF_35, SF_36]
