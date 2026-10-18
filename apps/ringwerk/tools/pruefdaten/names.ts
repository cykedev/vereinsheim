// Erfundene Namen für den Prüfbestand (ADR-029: keine echten Personen). Vornamen aus einer festen Liste, Nachnamen aus
// Baum- und Flussnamen. Dazu sechzehn lange Namen mit Bindestrich und Umlauten für die Ränder der Darstellung.

import type { Random } from "./random"

export interface PersonName {
  firstName: string
  lastName: string
}

const FIRST_NAMES = [
  "Anja",
  "Bernd",
  "Carla",
  "Dieter",
  "Elif",
  "Florian",
  "Greta",
  "Hannes",
  "Ines",
  "Jonas",
  "Karin",
  "Lukas",
  "Mara",
  "Nils",
  "Olga",
  "Paul",
  "Rita",
  "Sven",
  "Tilda",
  "Uwe",
  "Vera",
  "Wolf",
  "Yasmin",
  "Zoe",
] as const

const LAST_NAMES = [
  "Ahorn",
  "Birke",
  "Buche",
  "Eibe",
  "Eiche",
  "Erle",
  "Esche",
  "Fichte",
  "Kiefer",
  "Lärche",
  "Linde",
  "Pappel",
  "Ulme",
  "Weide",
  "Tanne",
  "Isar",
  "Inn",
  "Lech",
  "Loisach",
  "Amper",
  "Würm",
  "Ilz",
  "Regen",
  "Altmühl",
  "Mangfall",
  "Saalach",
  "Traun",
  "Vils",
] as const

/** Lange Namen für Tabellen, Brackets und PDFs; jeder genau einmal. */
export const LONG_NAMES: readonly PersonName[] = [
  { firstName: "Ännchen", lastName: "Überlinger-Großkopf" },
  { firstName: "Maximiliane-Theresia", lastName: "Wasserburger-Mangfallufer" },
  { firstName: "Bartholomäus", lastName: "Oberammergauer-Kieferngrund" },
  { firstName: "Friederike", lastName: "Schwarzenbacher-Lärchenhöhe" },
  { firstName: "Hans-Jörg", lastName: "Ilzstädter-Weidenbrück" },
  { firstName: "Konstantin", lastName: "Regenstaufer-Erlengrund" },
  { firstName: "Ottilie", lastName: "Tannenberger-Saalachau" },
  { firstName: "Wilhelmine", lastName: "Altmühltaler-Eichenschlag" },
  { firstName: "Jürgen-Ulrich", lastName: "Pappelreuther-Vilsbiburg" },
  { firstName: "Gisela", lastName: "Lindenschmidt-Würmseeufer" },
  { firstName: "Leopoldine", lastName: "Ahornberger-Ampermoos" },
  { firstName: "Siegfried", lastName: "Eschenloher-Loisachgrund" },
  { firstName: "Mechthild", lastName: "Fichtelberger-Traunreuter" },
  { firstName: "Engelbert", lastName: "Buchenhüller-Lechbrucker" },
  { firstName: "Rosalinde", lastName: "Ulmenstätter-Innleitner" },
  { firstName: "Kunigunde", lastName: "Birkenfelder-Isarauer" },
]

/** `count` verschiedene Namen; die Paare Vorname/Nachname wiederholen sich nicht. */
export function inventNames(random: Random, count: number): PersonName[] {
  const all: PersonName[] = []
  for (const lastName of LAST_NAMES) {
    for (const firstName of FIRST_NAMES) all.push({ firstName, lastName })
  }
  if (count > all.length) throw new Error(`Nur ${all.length} Namen möglich, nicht ${count}`)
  return random.shuffle(all).slice(0, count)
}
