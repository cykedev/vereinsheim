# Ersetzt Personendaten in tab-getrennten Blöcken durch stabile Pseudonyme (ADR-029):
# Namensspalten -> P1, P2, …; Sportpass-Spalten -> S1, S2, … (gleicher Wert, gleiches Pseudonym).
# Spalten werden ohne Groß-/Kleinschreibung erkannt: nachname, vorname, name, geburt*, sportpass*, passnr.
# Platzhalter bleiben stehen: leer, NULL, --frei--, unknown und eine Sportpassnummer 0 (SF-13).
# Kopfzeile ist die erste Zeile der Eingabe und die erste Zeile nach einem Tabellenmarker
# (#Scheiben, #Serien, #Treffer: "#" direkt gefolgt von Buchstaben). Andere "#"-Zeilen (# stand …,
# # schritt …) gehen unverändert durch und setzen den Kopf nicht zurück (Review S2).
BEGIN { FS = OFS = "\t"; kopf = 1; np = 0; ns = 0 }
/^#[A-Za-z]+$/ { print; kopf = 1; next }
/^#/ { print; next }
kopf {
  for (i = 1; i <= NF; i++) {
    n = tolower($i)
    typ[i] = ""
    if (n == "nachname" || n == "vorname" || n == "name" || n ~ /^geburt/) typ[i] = "name"
    if (n ~ /^sportpass/ || n == "passnr") typ[i] = "pass"
  }
  spalten = NF; kopf = 0; print; next
}
{
  for (i = 1; i <= spalten; i++) {
    if (typ[i] == "name" && $i != "" && $i != "NULL" && $i != "--frei--" && $i != "unknown") {
      if (!($i in name)) name[$i] = "P" (++np)
      $i = name[$i]
    } else if (typ[i] == "pass" && $i != "" && $i != "NULL" && $i != "0") {
      if (!($i in pass)) pass[$i] = "S" (++ns)
      $i = pass[$i]
    }
  }
  print
}
