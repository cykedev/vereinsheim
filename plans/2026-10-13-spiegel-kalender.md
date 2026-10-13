# Spiegel: Kalender der Trainingstage (T7)

## Kontext

Auftrag des Users (13. Oktober 2026): „mach autonom weiter“. Offen in SP-2.1 war der Kalender (T7, [[spiegel-statistics]]:
„Trainingstage als Kalender“, Zeitraum, B); [[spiegel-langzeit]] sah „Kalender oder Umfang je Woche unter dem Verlauf“
vor. Ohne Rückfrage gestaltet; der User kann es nach dem Merge ansehen und verwerfen.

## Entscheidungen

- **D1 Ort:** im Kasten des Umfangs, umschaltbar „Wochen | Kalender“ (Segment-Umschalter), damit die feste linke
  Spalte ab 768 px nicht höher wird. Die Wahl ist „wie gezeichnet“ und steht nicht in der Adresse.
- **D2 Form:** je ISO-Woche eine Spalte Montag bis Sonntag (wie die Wochen des Umfangs), 13-px-Felder, Monat über der
  Woche, in der er beginnt; Tage außerhalb des Zeitraums leer, Tage ohne Training als Fläche.
- **D3 Tönung:** vier Stufen `primary` nach Schüssen relativ zum stärksten Tag des Zeitraums; Wettkampf (geltende Art)
  mit goldenem Rand. Legende „weniger … mehr“, Zahl der Trainingstage und Schüsse.
- **D4 Daten:** `periodModel.calendar` über `projectedVolume` je Abend (`eveningDay`, wie die Liste); Katalog T7 an
  `trainingVolume` (gleiche Rechnung, anderer Eimer). `eveningDay` zieht nach `period/calendar` (sonst ein Importkreis).
- **D5 Bedienung:** jeder Trainingstag ein Link an seinen Abend in der Liste (`listFromProgress` mit Anker), Name mit
  Tag, Scheiben, Schüssen und Wettkampf; scrollt in sich, anfangs die jüngsten Wochen.

## Prüfung

Tests für Modell (Abend vor 4 Uhr, Wettkampf) und Baustein (Wochen über Jahreswechsel, Stufen, Links, Rand),
Skriptprüfung um zwei Prüfungen erweitert (Kalender im Bild, Tag öffnet den Abend in der Liste).
