# Ersetzt Personendaten in tab-getrennten Blöcken durch stabile Pseudonyme (ADR-029):
# Nachname/Vorname -> P1, P2, …; SportpassID -> S1, S2, … (gleicher Wert, gleiches Pseudonym).
# Platzhalter bleiben stehen: leer, NULL, --frei-- und SportpassID 0 (SF-13).
# Kopfzeile ist die erste Zeile der Eingabe und jede Zeile nach einer Zeile, die mit "#" beginnt;
# "#"-Zeilen selbst gehen unverändert durch. So passt es auf jede Spaltenreihenfolge.
BEGIN { FS = OFS = "\t"; kopf = 1; np = 0; ns = 0 }
/^#/ { print; kopf = 1; next }
kopf {
  for (i = 1; i <= NF; i++) {
    typ[i] = ""
    if ($i == "Nachname" || $i == "Vorname") typ[i] = "name"
    if ($i == "SportpassID") typ[i] = "pass"
  }
  spalten = NF; kopf = 0; print; next
}
{
  for (i = 1; i <= spalten; i++) {
    if (typ[i] == "name" && $i != "" && $i != "NULL" && $i != "--frei--") {
      if (!($i in name)) name[$i] = "P" (++np)
      $i = name[$i]
    } else if (typ[i] == "pass" && $i != "" && $i != "NULL" && $i != "0") {
      if (!($i in pass)) pass[$i] = "S" (++ns)
      $i = pass[$i]
    }
  }
  print
}
