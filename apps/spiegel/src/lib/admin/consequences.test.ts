import { describe, expect, it } from "vitest"

import {
  accountChange,
  bridgeRevoke,
  consentConfirm,
  consentReject,
  consentRemove,
  notMine,
  ownConsentRevoke,
  ownRejectionRemove,
  rankingKind,
  siteTimeZone,
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
  it("bestätigen: prüfen, was die Brücke ab wann schickt, was der Admin nicht sieht", () => {
    const d = consentConfirm({ who, sportpassId })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Zustimmung von Max Muster bestätigen?",
      about:
        "Max Muster möchte, dass Scheiben mit der SportpassID 12345678 automatisch in das eigene Konto kommen.",
      check:
        "Gehört 12345678 in der Meyton-Schützenverwaltung zu Max Muster? Wenn nicht: ablehnen.",
      happens: [
        "Ab dem nächsten Trainingsabend schickt die Brücke jede Scheibe mit dieser Nummer.",
        "Die erste zeigt Spiegel Max Muster zur Kontrolle; erst danach erscheinen die Scheiben im Konto.",
      ],
      notHappening: [
        "Du siehst die Schüsse von Max Muster nicht.",
        "Scheiben von früheren Abenden kommen nicht von selbst; höchstens die des letzten Abends, wenn die Brücke beim nächsten Start nachholt.",
      ],
      undo: "Jederzeit über „Entfernen“. Schon geschickte Scheiben bleiben bei Max Muster.",
      confirmLabel: "Bestätigen",
      destructive: false,
    })
  })

  it("ablehnen: nichts gelöscht; eine aktive behält ihre Scheiben", () => {
    const waiting = consentReject({ who, sportpassId, active: false })
    wellFormed(waiting)
    expect(waiting).toMatchObject({
      title: "Zustimmung von Max Muster ablehnen?",
      about: "Max Muster hat für die SportpassID 12345678 zugestimmt.",
      happens: [
        "Die Brücke schickt nichts unter dieser Nummer.",
        "Max Muster sieht im Profil „abgelehnt“ und kann die Ablehnung entfernen und neu zustimmen.",
      ],
      notHappening: ["Gelöscht wird nichts."],
      undo: "Stimmt Max Muster neu zu, kannst du bestätigen.",
      confirmLabel: "Ablehnen",
      destructive: true,
    })
    expect(consentReject({ who, sportpassId, active: true }).notHappening).toEqual([
      "Gelöscht wird nichts.",
      "Schon geschickte Scheiben bleiben bei Max Muster.",
    ])
  })

  it("entfernen: die Nummer wird frei, Scheiben bleiben", () => {
    const d = consentRemove({ who, sportpassId })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Zustimmung von Max Muster entfernen?",
      about: "Die SportpassID 12345678 wird vom Konto von Max Muster gelöst.",
      happens: [
        "Ab dem nächsten Trainingsabend schickt die Brücke nichts mehr unter dieser Nummer.",
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

describe("Folgen an Anlage und Brücke", () => {
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

  it("Rangliste: wie viele Scheiben, was sich ändert, was nicht", () => {
    const d = rankingKind({ ranking: "RWK_LP", cards: 23, kind: "competition" })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "„RWK_LP“ als Wettkampf zählen?",
      about: "Meyton nennt 23 Scheiben mit der Rangliste „RWK_LP“.",
      happens: [
        "Diese Scheiben zählen als Wettkampf: in Liste, Fortschritt und bei der Wertung, die Spiegel vorschlägt (Wettkampf in der amtlichen).",
        "Neue Scheiben dieser Rangliste ebenso.",
      ],
      notHappening: [
        "Hat ein Schütze eine Scheibe selbst umgestellt, bleibt seine Wahl.",
        "Eine Scheibe nur aus Probe bleibt Training.",
        "Schüsse und Ergebnisse ändern sich nicht.",
      ],
      undo: "Jederzeit hier umstellen.",
      confirmLabel: "Als Wettkampf zählen",
    })
    expect(rankingKind({ ranking: "Training-LP", cards: 1, kind: "training" })).toMatchObject({
      title: "„Training-LP“ als Training zählen?",
      about: "Meyton nennt 1 Scheibe mit der Rangliste „Training-LP“.",
      confirmLabel: "Als Training zählen",
    })
    expect(rankingKind({ ranking: "X", cards: 0, kind: "open" })).toMatchObject({
      title: "„X“ nicht zuordnen?",
      about: "Noch keine Scheibe trägt die Rangliste „X“.",
      confirmLabel: "Nicht zuordnen",
    })
    expect(rankingKind({ ranking: "X", cards: 0, kind: "open" }).happens[0]).toBe(
      "Ihre Scheiben zählen als Training: in Liste, Fortschritt und bei der Wertung, die Spiegel vorschlägt."
    )
  })

  it("Zeitzone: nur neu eingelesene Scheiben", () => {
    const d = siteTimeZone({ zone: "Europe/Vienna" })
    wellFormed(d)
    expect(d).toMatchObject({
      title: "Zeitzone auf Europe/Vienna ändern?",
      happens: ["Neu eingelesene Scheiben bekommen ihre Uhrzeit in Europe/Vienna."],
      notHappening: ["Schon eingelesene Scheiben behalten ihre Uhrzeit."],
      confirmLabel: "Ändern",
    })
  })
})

describe("Konto ändern", () => {
  it("ohne Rolle, Status oder Passwort keine Rückfrage", () => {
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
    expect(all.happens).toContain(
      "Max Muster verwaltet Konten, Zustimmungen und die Brücke. Die eigenen Scheiben bleiben sichtbar, fremde Schüsse nie."
    )
    expect(all.check).toBe("Gib das Passwort persönlich weiter, nicht per Mail.")

    const password = accountChange({ who, changes: { password: true } })!
    expect(password.happens).toEqual([
      "Max Muster wird abgemeldet und muss das neue Passwort bei der nächsten Anmeldung ersetzen. Bis dahin sind keine Daten zu sehen.",
    ])
    expect(accountChange({ who, changes: { role: "USER" } })!.happens).toEqual([
      "Max Muster verliert den Zugang zum Admin.",
      "Max Muster wird abgemeldet.",
    ])
    expect(accountChange({ who, changes: { active: true } })!.happens).toEqual([
      "Max Muster kann sich wieder anmelden; aktive Zustimmungen gelten wieder.",
      "Max Muster wird abgemeldet.",
    ])
  })
})

describe("Folgen beim Schützen", () => {
  it("widerrufen, Ablehnung entfernen, nicht meine", () => {
    const revoke = ownConsentRevoke({ sportpassId })
    wellFormed(revoke)
    expect(revoke).toMatchObject({
      title: "Zustimmung für 12345678 widerrufen?",
      happens: ["Ab dem nächsten Trainingsabend kommen keine neuen Scheiben mehr."],
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
      happens: [
        "Diese Scheiben werden entfernt, mit ihren Rohdaten, und kommen nicht wieder.",
        "Deine Zustimmung geht zur Prüfung zurück an einen Admin; bis dahin kommen keine Scheiben unter dieser Nummer.",
      ],
    })
  })
})
