// Fälle zu Korrektur und Lesung: Korrektur, Löschung mit Nachrücken, geleerte Ablage, zerrissene Lesung, Anzeigeart.

import { numbers } from "../expected"
import { scheibenIdAt } from "../stand"
import { defineCase, evening, idAt } from "./case"
import { fire, group, LG20, LP40, minutes, until } from "./helpers"

const SF21_START = evening(19)
const SF21_ID = idAt(SF21_START)

export const SF_21 = defineCase({
  id: "SF-21",
  title: "Korrektur durch die Standaufsicht",
  description:
    "LG 20, nach dem Ende ändert die Standaufsicht Schuss 8 (Lage und Wert). Wie Meyton korrigiert, ist nicht beobachtet; angenommen ist: dieselbe Zeile, neue Lage und Werte, Zeit bleibt.",
  start: SF21_START,
  run(sim) {
    const card = sim.card({ ...LG20, scheibenId: SF21_ID, standNr: 2 })
    fire(sim, card, 1, group(20, 2101, 150))
    sim.read("20 Schuss")
    sim.advance(minutes(3))
    card.correct(1, 8, 40, -30)
    sim.read("Schuss 8 korrigiert")
  },
  expected: [
    {
      scheibenId: SF21_ID,
      bridge: "senden",
      shots: [
        [0, 20],
        [0, 20],
      ],
      flags: ["korrigiert"],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Ein geänderter Wertungsschuss ergibt eine neue Revision; die Wertung folgt dem neuesten Snapshot.",
      ],
    },
  ],
})

const SF22_START = evening(20)
const SF22_ID = idAt(SF22_START)

export const SF_22 = defineCase({
  id: "SF-22",
  title: "Löschung mit Nachrücken",
  description:
    "LG 20, Schuss 5 wird gelöscht; die Schüsse 6 bis 20 rücken auf 5 bis 19 nach (Annahme, nicht beobachtet). Wer über die Nummer abgleicht, zeigt auf den falschen Schuss.",
  start: SF22_START,
  run(sim) {
    const card = sim.card({ ...LG20, scheibenId: SF22_ID, standNr: 3 })
    fire(sim, card, 1, group(20, 2201, 150))
    sim.read("20 Schuss")
    sim.advance(minutes(2))
    card.remove(1, 5)
    sim.read("Schuss 5 gelöscht, die übrigen nachgerückt")
  },
  expected: [
    {
      scheibenId: SF22_ID,
      bridge: "senden",
      shots: [
        [0, 20],
        [0, 19],
      ],
      flags: ["korrigiert", "unvollstaendig"],
      completeness: "unvollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 19) },
      notes: [
        "Schuss 6 der ersten Lesung ist Schuss 5 der zweiten: Abgleich über den Fingerabdruck (Zeit, Millisekunden, Lage); Notizen und Teilungen hängen an ihm.",
      ],
    },
  ],
})

const SF23_START = evening(21)
const SF23_A = idAt(SF23_START)
const SF23_B_AT = SF23_START + minutes(40)
const SF23_B = idAt(SF23_B_AT)
/** der Server wird neu aufgesetzt, der Zähler der ScheibenIDs beginnt von vorn */
const SF23_RESET = SF23_START + minutes(24 * 60)
const SF23_C_AT = SF23_RESET + minutes(30)
const SF23_C = scheibenIdAt(SF23_RESET, SF23_C_AT)

export const SF_23 = defineCase({
  id: "SF-23",
  title: "Ablage geleert",
  description:
    "Zwei Scheiben, dann wird der Server neu aufgesetzt: Die Ablage ist leer, der Zähler der ScheibenIDs beginnt von vorn, die erste neue Scheibe hat eine kleine ID.",
  start: SF23_START,
  run(sim) {
    const a = sim.card({ ...LG20, scheibenId: SF23_A, standNr: 4 })
    fire(sim, a, 1, group(20, 2301, 150))
    until(sim, SF23_B_AT)
    const b = sim.card({ ...LG20, scheibenId: SF23_B, standNr: 5 })
    fire(sim, b, 1, group(20, 2302, 150))
    sim.read("zwei Scheiben")
    until(sim, SF23_RESET)
    sim.clear()
    sim.read("Ablage leer")
    until(sim, SF23_C_AT)
    const c = sim.card({ ...LG20, scheibenId: SF23_C, standNr: 4 })
    fire(sim, c, 1, group(20, 2303, 150))
    sim.read("erste Scheibe nach dem Neuaufsetzen")
  },
  expected: [
    {
      scheibenId: SF23_A,
      bridge: "senden",
      shots: [[0, 20], null, null],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Verschwindet alles auf einmal, ist das keine Löschung: ein Hinweis, keine Merkmale an den Scheiben (Leitregel 4).",
      ],
    },
    {
      scheibenId: SF23_B,
      bridge: "senden",
      shots: [[0, 20], null, null],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
    },
    {
      scheibenId: SF23_C,
      bridge: "senden",
      shots: [null, null, [0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Eine neue Epoche gilt erst nach Bestätigung durch den Admin; die Snapshots hier tragen noch Epoche 1.",
      ],
    },
  ],
})

const SF71_START = evening(22)
const SF71_ID = idAt(SF71_START)

export const SF_71 = defineCase({
  id: "SF-71",
  title: "Zerrissene Lesung",
  description:
    "LP 40, fertig. Meyton schreibt die Scheibe neu (Löschen und Einfügen, Kaskade): Eine Lesung erwischt die Kopfzeile mit 40 Treffern, aber keine Zeile in `Treffer` und `Serien`.",
  start: SF71_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF71_ID, standNr: 6 })
    fire(sim, card, 1, group(40, 7101, 800))
    sim.read("40 Schuss")
    sim.advance(1_000)
    card.tear()
    sim.read("zerrissen: Kopfzeile ohne Treffer")
    card.mend()
    sim.advance(1_000)
    sim.read("wieder ganz")
    sim.advance(1_000)
    sim.read("unverändert")
  },
  expected: [
    {
      scheibenId: SF71_ID,
      bridge: "senden",
      shots: [
        [0, 40],
        [0, 0],
        [0, 40],
        [0, 40],
      ],
      sentReadings: [3],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 40) },
      notes: [
        "Gesendet wird erst, wenn zwei Lesungen hintereinander gleich sind: Lesung 3 und 4.",
        "Lesung 2 ist keine Löschung: Fehlen ist keine Löschung (Leitregel 4).",
      ],
    },
  ],
})

const SF74_START = evening(23)
const SF74_ID = idAt(SF74_START)

export const SF_74 = defineCase({
  id: "SF-74",
  title: "Anzeigeart am Monitor umgeschaltet",
  description:
    "LP 40 in ganzen Ringen; nach 20 Schuss schaltet der Schütze die Anzeige auf Zehntel mit Teiler (7). Meyton schreibt `Wertung` und `Text` der Serie 2 neu, Werte und Lage bleiben.",
  start: SF74_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF74_ID, standNr: 7 })
    fire(sim, card, 1, group(20, 7401, 800))
    sim.read("20 Schuss in ganzen Ringen")
    card.setDisplay(7, 2)
    sim.read("Serie 2 auf Zehntel mit Teiler umgeschaltet")
    fire(sim, card, 1, group(20, 7402, 800))
    sim.read("40 Schuss")
  },
  expected: [
    {
      scheibenId: SF74_ID,
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
        "Lesung 2 unterscheidet sich nur in `Wertung` und `Text`: keine neue Revision eines Schusses, keine Korrektur.",
        "Amtlich bleibt die Wertung der Disziplin (ganze Ringe), nie die Anzeigeart.",
      ],
    },
  ],
})

export const REVISION_CASES = [SF_21, SF_22, SF_23, SF_71, SF_74]
