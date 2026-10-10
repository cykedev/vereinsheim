// Fälle zur Vollständigkeit und zum Abend: abgebrochen, über der Soll-Zahl, ohne Schusszahl, lange Pause, mehrere
// Scheiben an einem Abend.

import { numbers } from "../expected"
import { defineCase, evening, idAt } from "./case"
import { away, fire, group, LG40, LP20, LP40, minutes, until, wait } from "./helpers"

const SF07_START = evening(7)
const SF07_A = idAt(SF07_START)
const SF07_B_AT = SF07_START + minutes(15)
const SF07_B = idAt(SF07_B_AT)

export const SF_07 = defineCase({
  id: "SF-07",
  title: "Abgebrochene Scheibe",
  description:
    "LG 40 nach 10 Schuss abgebrochen, am selben Stand unter einer neuen ScheibenID fortgesetzt (so am 9. Oktober 2026 beobachtet). Zwei Scheiben, die erste unvollständig.",
  start: SF07_START,
  run(sim) {
    const a = sim.card({ ...LG40, scheibenId: SF07_A, standNr: 6 })
    fire(sim, a, 1, group(10, 701, 150))
    sim.read("10 von 40, dann abgebrochen")
    until(sim, SF07_B_AT)
    const b = sim.card({ ...LG40, scheibenId: SF07_B, standNr: 6 })
    fire(sim, b, 1, group(20, 702, 150))
    sim.read("neue Scheibe, 20 Schuss")
    fire(sim, b, 1, group(20, 703, 150))
    sim.read("neue Scheibe, 40 Schuss")
  },
  expected: [
    {
      scheibenId: SF07_A,
      bridge: "senden",
      shots: [
        [0, 10],
        [0, 10],
        [0, 10],
      ],
      flags: ["unvollstaendig"],
      completeness: "unvollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 10) },
      notes: [
        "Summen nur für vollständige Scheiben, sonst Werte je Schuss; kein Zusammenfügen mit der Folgescheibe.",
      ],
    },
    {
      scheibenId: SF07_B,
      bridge: "senden",
      shots: [null, [0, 20], [0, 40]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 40) },
    },
  ],
})

const SF08_START = evening(8)
const SF08_ID = idAt(SF08_START)

export const SF_08 = defineCase({
  id: "SF-08",
  title: "Mehr Wertungsschüsse als die Disziplin",
  description:
    "LG 40 mit 46 Wertungsschüssen: Die Schüsse 41 bis 46 stehen mit echter Lage, aber Wert 0, „0F“ und Platzhalter-Teiler 2147483647; `Trefferzahl` zählt sie mit.",
  start: SF08_START,
  run(sim) {
    const card = sim.card({ ...LG40, scheibenId: SF08_ID, standNr: 1 })
    fire(sim, card, 1, group(40, 801, 150))
    sim.read("40 Schuss")
    fire(sim, card, 1, group(6, 802, 150))
    sim.read("46 Schuss")
  },
  expected: [
    {
      scheibenId: SF08_ID,
      bridge: "senden",
      shots: [
        [0, 40],
        [0, 46],
      ],
      flags: ["ueber-soll"],
      completeness: "ueber-soll",
      counted: { stellung: 1, numbers: numbers(1, 46) },
      notes: [
        "Schüsse 41 bis 46: Platzhalter-Teiler heißt „kein Abstand“; amtlich 0, nicht in Kennzahlen der Lage, keine Gegenprobe (aus der Lage wären sie bis 10,6).",
        "Abschluss nie allein über die Schusszahl: Nach 40 kann weiter geschossen werden.",
      ],
    },
  ],
})

const SF09_START = evening(9)
const SF09_ID = idAt(SF09_START)

export const SF_09 = defineCase({
  id: "SF-09",
  title: "Disziplin ohne Schusszahl",
  description:
    "Ein Training auf einer Disziplin mit Schusscode 000 (19110000, so an der Vereinsanlage belegt): Ohne Soll gibt es keinen Abschluss über die Zahl.",
  start: SF09_START,
  run(sim) {
    const card = sim.card({
      ...LG40,
      disziplinId: 19110000,
      disziplin: "LG Training",
      scheibenId: SF09_ID,
      standNr: 10,
    })
    fire(sim, card, 1, group(25, 901, 150))
    sim.read("25 Schuss")
    away(sim, minutes(20))
    sim.read("Stand frei")
  },
  expected: [
    {
      scheibenId: SF09_ID,
      bridge: "senden",
      shots: [
        [0, 25],
        [0, 25],
      ],
      flags: [],
      completeness: "offen",
      counted: { stellung: 1, numbers: numbers(1, 25) },
      notes: [
        "Zustand über das Lebenszeichen: offen, ruhend nach 5 Minuten ohne, endgültig nach 12 Stunden ohne Änderung.",
      ],
    },
  ],
})

const SF10_START = evening(10)
const SF10_ID = idAt(SF10_START)

export const SF_10 = defineCase({
  id: "SF-10",
  title: "Lange Pause mitten im Training",
  description:
    "LP 40: 20 Schuss, dann zwölf Minuten Pause am belegten Stand, dann 20 Schuss. Das Lebenszeichen läuft weiter, die Scheibe bleibt offen.",
  start: SF10_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF10_ID, standNr: 8 })
    fire(sim, card, 1, group(20, 1001, 800))
    sim.read("20 Schuss")
    wait(sim, card, minutes(6))
    sim.read("6 Minuten ohne Schuss, das Lebenszeichen läuft")
    wait(sim, card, minutes(6))
    fire(sim, card, 1, group(20, 1002, 800))
    sim.read("40 Schuss")
  },
  expected: [
    {
      scheibenId: SF10_ID,
      bridge: "senden",
      shots: [
        [0, 20],
        [0, 20],
        [0, 40],
      ],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 40) },
      notes: [
        "Lesung 2: kein Schuss seit 6 Minuten, aber das Lebenszeichen ist frisch: offen, nicht ruhend.",
        "Lesung 2 unterscheidet sich von Lesung 1 nur im Lebenszeichen (`Scheiben.Zeitstempel`).",
      ],
    },
  ],
})

const SF11_START = evening(11)
const SF11_A = idAt(SF11_START)
const SF11_B_AT = SF11_START + minutes(90)
const SF11_B = idAt(SF11_B_AT)
/** 00:30 Uhr MESZ am Tag danach */
const SF11_C_AT = SF11_START + minutes(5 * 60 + 30)
const SF11_C = idAt(SF11_C_AT)

export const SF_11 = defineCase({
  id: "SF-11",
  title: "Mehrere Scheiben an einem Abend",
  description:
    "Drei Scheiben LP 20 am selben Stand: 19:00, 20:30 und 00:30 Uhr. Alle gehören zum Abend des 11. Oktober, auch die nach Mitternacht (vor 4 Uhr zählt zum Vortag).",
  start: SF11_START,
  run(sim) {
    const a = sim.card({ ...LP20, scheibenId: SF11_A, standNr: 2 })
    fire(sim, a, 1, group(20, 1101, 800))
    sim.read("erste Scheibe")
    until(sim, SF11_B_AT)
    const b = sim.card({ ...LP20, scheibenId: SF11_B, standNr: 2 })
    fire(sim, b, 1, group(20, 1102, 800))
    sim.read("zweite Scheibe")
    until(sim, SF11_C_AT)
    const c = sim.card({ ...LP20, scheibenId: SF11_C, standNr: 2 })
    fire(sim, c, 1, group(20, 1103, 800))
    sim.read("dritte Scheibe nach Mitternacht")
  },
  expected: [
    {
      scheibenId: SF11_A,
      bridge: "senden",
      shots: [
        [0, 20],
        [0, 20],
        [0, 20],
      ],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: ["Abend 11. Oktober 2026."],
    },
    {
      scheibenId: SF11_B,
      bridge: "senden",
      shots: [null, [0, 20], [0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: ["Abend 11. Oktober 2026."],
    },
    {
      scheibenId: SF11_C,
      bridge: "senden",
      shots: [null, null, [0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: ["Abend 11. Oktober 2026: um 00:30 Uhr, vor 4 Uhr, also zum Vortag."],
    },
  ],
})

export const COMPLETENESS_CASES = [SF_07, SF_08, SF_09, SF_10, SF_11]
