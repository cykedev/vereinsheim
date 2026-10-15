import { describe, expect, it } from "vitest"

import { OLD_WORDS } from "./consequences"
import { ADMIN_HELP } from "./help"

describe("Erklärungen im Admin", () => {
  it("jede Station der Übersicht und jeder Begriff hat einen Text", () => {
    for (const id of [
      "site",
      "bridge",
      "pairingCode",
      "consent",
      "ranking",
      "timeZone",
      "role",
      "deactivated",
      "accounts",
    ] as const) {
      expect(ADMIN_HELP[id].title).not.toBe("")
      // kurze Sätze statt langer: höchstens fünf
      expect(ADMIN_HELP[id].text.split(". ").length).toBeLessThanOrEqual(5)
    }
  })

  it("keine Fachbegriffe, die der Admin nicht braucht", () => {
    const all = JSON.stringify(ADMIN_HELP)
    expect(all).not.toMatch(/Epoche|Neustart|Snapshot|Heartbeat|Token/)
  })

  it("Rolle nennt, was ein Admin je Konto sieht", () => {
    expect(ADMIN_HELP.role.text).toBe(
      "Ein Schütze sieht die eigenen Scheiben. Ein Admin verwaltet dazu Konten, Sportpassnummern und die Brücke. Fremde Schüsse sieht auch ein Admin nie, je Konto nur die Zahl der Scheiben und den Tag der letzten."
    )
    expect(ADMIN_HELP.pairingCode.title).toBe("Code für die Brücke")
  })

  it("„Liste“ statt „Rangliste“", () => {
    expect(ADMIN_HELP.ranking).toEqual({
      title: "Liste",
      text: "Meyton ordnet jede Scheibe einer Liste des Vereins zu, etwa „Training-LP“ oder „RWK_…“. Hier legst du fest, welche als Wettkampf zählen. Alle anderen zählen so, wie Meyton sie vermerkt. Meist ist das Training.",
    })
    // die Leitplanke hält das alte Wort fern
    for (const old of ["Rangliste", "Ranglisten", "rangliste"]) expect(old).toMatch(OLD_WORDS)
    expect("Liste").not.toMatch(OLD_WORDS)
  })

  it("Schreibregeln: keine Semikolons, keine alten Wörter", () => {
    for (const { title, text } of Object.values(ADMIN_HELP))
      for (const value of [title, text]) expect(value).not.toMatch(OLD_WORDS)
  })
})
