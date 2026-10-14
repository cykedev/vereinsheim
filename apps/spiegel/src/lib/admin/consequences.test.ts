import { describe, expect, it } from "vitest"

import {
  accountChange,
  accountChangesOf,
  bridgeRevoke,
  consentConfirm,
  consentReject,
  consentRemove,
  notMine,
  ownConsentRevoke,
  ownRejectionRemove,
  rankingKind,
  type Decision,
} from "./consequences"

const who = "Max Muster"
const sportpassId = "12345678"

/** jeder Entscheid sagt, worum es geht, was passiert und wie es zurückgeht; kein Platzhalter bleibt stehen */
function wellFormed(decision: Decision) {
  expect(decision.title).not.toBe("")
  expect(decision.about).not.toBe("")
  expect(decision.happens.length).toBeGreaterThan(0)
  expect(decision.undo).not.toBe("")
  expect(JSON.stringify(decision)).not.toMatch(/[<>]|undefined|null/)
}

describe("Folgen der Zustimmungen (Admin)", () => {
  it("bestätigen: wann die Brücke schickt, was nie hinausgeht, was mit älteren Scheiben ist (Review)", () => {
    const d = consentConfirm({ who, sportpassId })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Zustimmung von Max Muster bestätigen?",
      about:
        "Max Muster möchte, dass Scheiben mit der SportpassID 12345678 automatisch in das eigene Konto kommen.",
      check:
        "Gehört 12345678 in der Meyton-Schützenverwaltung zu Max Muster? Wenn nicht: ablehnen.",
      happens: [
        "Läuft die Brücke gerade, kommen Scheiben mit dieser Nummer innerhalb weniger Minuten, auch vom laufenden Abend; sonst beim nächsten Training.",
        "Die erste zeigt Spiegel Max Muster zur Kontrolle; erst danach erscheinen die Scheiben im Konto.",
      ],
      notHappening: [
        "Du siehst die Schüsse von Max Muster nicht.",
        "Scheiben mit verdeckter Wertung gehen nie hinaus.",
        "Ältere Scheiben kommen nicht verlässlich vollständig: nur, was die Brücke beim nächsten Start nachholt (alles seit der letzten Lieferung an Spiegel).",
      ],
      undo: "Jederzeit über „Entfernen“. Schon geschickte Scheiben bleiben bei Max Muster.",
      confirmLabel: "Bestätigen",
      destructive: false,
    })
  })

  it("bestätigen nach „nicht meine“ und bei deaktiviertem Konto sagt das (Review)", () => {
    const returned = consentConfirm({ who, sportpassId, returned: true })
    wellFormed(returned)
    expect(returned.about).toBe(
      "Max Muster hat die erste Scheibe unter der SportpassID 12345678 als „nicht meine“ gemeldet; diese Scheiben sind entfernt. Bestätigst du, gilt die Nummer wieder für Max Muster."
    )
    expect(returned.check).toContain("Vielleicht wurde am Stand ein fremder Name gewählt.")
    expect(consentConfirm({ who, sportpassId, accountActive: false }).happens).toContain(
      "Solange das Konto von Max Muster deaktiviert ist, schickt die Brücke nichts."
    )
  })

  it("ablehnen: Spiegel nimmt nichts an, nichts gelöscht", () => {
    const d = consentReject({ who, sportpassId })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Zustimmung von Max Muster ablehnen?",
      about: "Max Muster hat für die SportpassID 12345678 zugestimmt.",
      happens: [
        "Spiegel nimmt unter dieser Nummer nichts an.",
        "Max Muster sieht im Profil „abgelehnt“ und kann die Ablehnung entfernen und neu zustimmen.",
      ],
      notHappening: ["Gelöscht wird nichts."],
      undo: "Stimmt Max Muster neu zu, kannst du bestätigen.",
      confirmLabel: "Ablehnen",
      destructive: true,
    })
  })

  it("entfernen: ab sofort, die Nummer wird frei, Scheiben bleiben (Review)", () => {
    const d = consentRemove({ who, sportpassId })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Zustimmung von Max Muster entfernen?",
      about: "Die SportpassID 12345678 wird vom Konto von Max Muster gelöst.",
      happens: [
        "Ab sofort nimmt Spiegel unter dieser Nummer nichts mehr an.",
        "Die Nummer ist wieder frei; jedes Konto kann für sie zustimmen.",
      ],
      notHappening: [
        "Schon geschickte Scheiben bleiben bei Max Muster; löschen kann sie nur Max Muster selbst.",
      ],
      undo: "Max Muster stimmt im Profil neu zu, du bestätigst.",
      confirmLabel: "Entfernen",
      destructive: true,
    })
  })
})

describe("Folgen an Brücke und Ranglisten", () => {
  it("Brücke widerrufen: sofort, nichts gelöscht, nicht rückgängig", () => {
    const d = bridgeRevoke({ device: "Pi im Schützenhaus" })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Brücke „Pi im Schützenhaus“ widerrufen?",
      about: "Das Gerät „Pi im Schützenhaus“ darf Scheiben an Spiegel schicken.",
      happens: ["Ab sofort nimmt Spiegel von diesem Gerät nichts mehr an; es meldet sich ab."],
      notHappening: ["Keine Scheibe wird gelöscht.", "Andere Brücken laufen weiter."],
      undo: "Nicht möglich. Um das Gerät wieder zu nutzen, es mit einem neuen Code koppeln.",
      confirmLabel: "Widerrufen",
      destructive: true,
    })
  })

  it("Rangliste: Scheiben in Spiegel, das Ergebnis kann wechseln, Schüsse nicht (Review)", () => {
    const d = rankingKind({ ranking: "RWK_LP", cards: 23, kind: "competition" })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "„RWK_LP“ als Wettkampf zählen?",
      about: "In Spiegel tragen 23 Scheiben die Rangliste „RWK_LP“.",
      happens: [
        "Diese Scheiben und neue dieser Rangliste zählen als Wettkampf, in Liste und Fortschritt.",
        "Vorgeschlagen wird dann die amtliche Wertung der Disziplin; das angezeigte Ergebnis kann wechseln, etwa ganze Ringe statt Zehntel.",
      ],
      notHappening: [
        "Hat ein Schütze eine Scheibe selbst umgestellt, bleibt seine Wahl.",
        "Eine Scheibe nur aus Probe bleibt Training.",
        "Schüsse ändern sich nicht.",
      ],
      undo: "Jederzeit hier umstellen.",
      confirmLabel: "Als Wettkampf zählen",
    })
    expect(JSON.stringify(d)).not.toContain("Ergebnisse ändern sich nicht")
    expect(rankingKind({ ranking: "Training-LP", cards: 1, kind: "training" })).toMatchObject({
      title: "„Training-LP“ als Training zählen?",
      about: "In Spiegel trägt 1 Scheibe die Rangliste „Training-LP“.",
      confirmLabel: "Als Training zählen",
    })
    const open = rankingKind({ ranking: "X", cards: 0, kind: "open" })
    expect(open).toMatchObject({
      title: "„X“ nicht zuordnen?",
      about: "Noch keine Scheibe in Spiegel trägt die Rangliste „X“.",
      confirmLabel: "Nicht zuordnen",
    })
    expect(open.happens[0]).toBe(
      "Ihre Scheiben und neue dieser Rangliste zählen so, wie Meyton es an der Scheibe vermerkt; meist ist das Training."
    )
  })
})

describe("Konto ändern", () => {
  it("was das Formular ändert: nur Rolle, Status, Passwort", () => {
    const saved = { role: "USER" as const, isActive: true }
    expect(accountChangesOf(saved, { role: "USER", active: true, password: "" })).toEqual({})
    expect(accountChangesOf(saved, { role: "ADMIN", active: false, password: "x" })).toEqual({
      role: "ADMIN",
      active: false,
      password: true,
    })
    expect(accountChange({ who, changes: {} })).toBeNull()
  })

  it("nur die Folgen der geänderten Felder; abgemeldet genau einmal", () => {
    const deactivate = accountChange({ who, changes: { active: false } })!
    wellFormed(deactivate)
    expect(deactivate.happens).toEqual([
      "Max Muster kann sich nicht mehr anmelden.",
      "Die Brücke schickt nichts mehr unter den SportpassIDs von Max Muster.",
      "Max Muster wird abgemeldet.",
    ])
    expect(deactivate.notHappening).toEqual([
      "Scheiben und Zustimmungen bleiben, gelöscht wird nichts.",
    ])
    expect(deactivate.undo).toBe("Das Konto wieder aktivieren.")

    const all = accountChange({ who, changes: { role: "ADMIN", active: false, password: true } })!
    expect(all.happens.filter((line) => line.includes("abgemeldet"))).toHaveLength(1)
    expect(all.check).toBe("Gib das Passwort persönlich weiter, nicht per Mail.")
    expect(all.undo).toBe(
      "Das Konto wieder aktivieren. Die Rolle hier zurückstellen. Das alte Passwort lässt sich nicht zurückholen; bei Bedarf ein weiteres neues setzen."
    )
    expect(accountChange({ who, changes: { role: "USER" } })!.happens).toEqual([
      "Max Muster verliert den Zugang zum Admin.",
      "Max Muster wird abgemeldet.",
    ])
  })

  it("Passwort: kein Zurückstellen versprechen; Reaktivieren meldet niemanden ab (Review)", () => {
    const password = accountChange({ who, changes: { password: true } })!
    expect(password.undo).toBe(
      "Das alte Passwort lässt sich nicht zurückholen; bei Bedarf ein weiteres neues setzen."
    )
    const reactivate = accountChange({ who, changes: { active: true } })!
    expect(reactivate.happens).toEqual([
      "Max Muster kann sich wieder anmelden; aktive Zustimmungen gelten wieder.",
    ])
    expect(reactivate.undo).toBe("Das Konto wieder deaktivieren.")
  })
})

describe("Folgen beim Schützen", () => {
  it("widerrufen ab sofort, Ablehnung entfernen, nicht meine", () => {
    const revoke = ownConsentRevoke({ sportpassId })
    wellFormed(revoke)
    expect(revoke).toMatchObject({
      title: "Zustimmung für 12345678 widerrufen?",
      happens: ["Ab sofort kommen keine neuen Scheiben mehr unter dieser Nummer."],
      notHappening: ["Was schon da ist, bleibt, bis du es löschst."],
      undo: "Neu zustimmen; ein Admin bestätigt dann wieder.",
      destructive: true,
    })
    const remove = ownRejectionRemove()
    wellFormed(remove)
    expect(remove.notHappening).toEqual([
      "Es kommen keine Scheiben, bis ein Admin eine neue Zustimmung bestätigt.",
    ])
    const notMineOne = notMine({ evening: "Di 13.10.2026 · 19:12", more: 0, sportpassId })
    wellFormed(notMineOne)
    expect(notMineOne).toMatchObject({
      title: "Nicht deine Scheibe?",
      about: "Die Scheibe vom Di 13.10.2026 · 19:12 kam unter deiner SportpassID 12345678.",
      happens: [
        "Die Scheibe wird entfernt, mit ihren Rohdaten, und kommt nicht wieder.",
        "Deine Zustimmung geht zur Prüfung zurück an einen Admin; bis dahin kommen keine Scheiben unter dieser Nummer.",
      ],
      notHappening: ["Deine anderen Scheiben bleiben."],
      undo: "Nicht möglich.",
      confirmLabel: "Nicht meine",
      destructive: true,
    })
    expect(notMine({ evening: "Di 13.10.2026 · 19:12", more: 2, sportpassId })).toMatchObject({
      about:
        "Die Scheibe vom Di 13.10.2026 · 19:12 und 2 weitere kamen unter deiner SportpassID 12345678.",
    })
    // ohne Nummer geht keine Zustimmung zurück (Review)
    const without = notMine({ evening: "Di 13.10.2026 · 19:12", more: 0, sportpassId: null })
    wellFormed(without)
    expect(without.about).toBe("Die Scheibe vom Di 13.10.2026 · 19:12 kam ohne SportpassID.")
    expect(without.happens).toHaveLength(1)
  })
})
