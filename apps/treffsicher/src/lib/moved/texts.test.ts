import { forbiddenIn } from "@vereinsheim/lib/wording"
import { describe, expect, it } from "vitest"

import { TREFFSICHER_OLD_WORDS } from "@/lib/consequences"

import { MOVED_PAGES, MOVED_TEXTS } from "./texts"

const ALL = [
  ...Object.values(MOVED_TEXTS),
  ...Object.values(MOVED_PAGES).flatMap((page) => [page.title, page.text]),
]

describe("Texte für ein umgezogenes Konto", () => {
  it("halten den Wortlaut des Textbuchs", () => {
    expect(MOVED_TEXTS).toEqual({
      bannerTitle: "Dein Tagebuch ist jetzt in Spiegel.",
      bannerText:
        "Alle deine Einheiten, Ziele und Abläufe sind dorthin umgezogen. Hier kannst du noch alles nachlesen, aber nichts mehr ändern.",
      signIn: "Anmelden mit deinem Konto von Spiegel",
      bannerShort: "Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nur noch lesen.",
      toSpiegel: "Zu Spiegel",
      toSpiegelShort: "Spiegel",
      refusal: "Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nichts mehr ändern.",
      pageTitle: "Das geht jetzt in Spiegel.",
      emptyHint: "Neues legst du jetzt in Spiegel an.",
      password:
        "Dein Passwort änderst du jetzt in Spiegel, im Profil. In Treffsicher meldest du dich weiter mit deinem bisherigen Passwort an.",
      newSystemDiscipline: "Neue System-Disziplin",
    })
  })

  it("halten den Wortlaut der Seiten statt der Formulare", () => {
    expect(MOVED_PAGES).toEqual({
      sessionNew: {
        title: "Neue Einheit",
        text: "Dein Tagebuch ist umgezogen. Neue Einträge legst du in Spiegel unter „Tagebuch“ an.",
      },
      sessionEdit: {
        title: "Einheit bearbeiten",
        text: "Dein Tagebuch ist umgezogen. Deine Einträge änderst du in Spiegel unter „Tagebuch“.",
      },
      goalNew: {
        title: "Neues Ziel",
        text: "Deine Ziele sind mit umgezogen. Neue Ziele legst du in Spiegel unter „Tagebuch“ an, im Reiter „Ziele“.",
      },
      routineNew: {
        title: "Neuer Schuss-Ablauf",
        text: "Deine Abläufe sind mit umgezogen. Neue legst du in Spiegel unter „Tagebuch“ an, im Reiter „Abläufe“.",
      },
      routineEdit: {
        title: "Schuss-Ablauf bearbeiten",
        text: "Deine Abläufe sind mit umgezogen. Du änderst sie in Spiegel unter „Tagebuch“, im Reiter „Abläufe“.",
      },
      disciplineNew: {
        title: "Neue Disziplin",
        text: "Dein Tagebuch ist mit deinen eigenen Disziplinen umgezogen. Hier legst du keine neue mehr an.",
      },
      disciplineEdit: {
        title: "Disziplin bearbeiten",
        text: "Dein Tagebuch ist mit deinen eigenen Disziplinen umgezogen. Hier änderst du sie nicht mehr.",
      },
    })
  })

  it("folgen den Schreibregeln: kein Semikolon, keine drei Punkte, keine alten Wörter", () => {
    expect(forbiddenIn(ALL, TREFFSICHER_OLD_WORDS)).toEqual([])
  })
})
