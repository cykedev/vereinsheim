# Spiegel: Art der Scheibe aus der Rangliste

## Kontext

Offener Punkt der Roadmap (User, 12. Oktober 2026): `Status` der SSMDB2 ist an der Vereinsanlage leer, die Bedeutung
trägt die `Rangliste`, ein freier Text des Vereins („Training-LP“, „RWK_…“, „LG Vereinsmeister“). Der Admin soll sie einer
Art zuordnen ([[adr-029]]); die Wahl des Schützen geht vor. Umgesetzt am 13. Oktober 2026 nach „weiter“ des Users.

## Entscheidungen

- **D1 Tabelle `Ranking`** je Anlage (Name eindeutig), Art optional; `Card.rankingId` verweist darauf (Löschen setzt
  null). Das Einlesen legt eine Rangliste beim ersten Sehen ohne Art an, wie eine Disziplin (`rankingFor`).
- **D2 Art beim Lesen:** `kindOfRow` = Wahl des Schützen, sonst die Art der Rangliste, sonst die der Quelle (`Status`).
  Eine geänderte Zuordnung wirkt sofort auf alle Scheiben, ohne sie umzuschreiben; Start, Liste und Fortschritt rechnen
  ohnehin beim Lesen.
- **D3 Admin:** Abschnitt „Ranglisten“ auf „Anlage und Brücken“, je Rangliste „Offen | Training | Wettkampf“, sofort
  gespeichert (`setRankingKind`), danach `revalidatePath("/", "layout")`. Offen gilt als Training.
- **D4 Schema:** ersetzt die eine Migration (bis SP-1.9); die Dev-Datenbank additiv nachgezogen, den Reset macht der User.

## Nicht in diesem Plan

Ranglisten aus `seed:own` (die eigenen Ausdrucke haben keine), eine Vorbelegung nach Namen („RWK“ → Wettkampf).
