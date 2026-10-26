// meldet sich bereit und rechnet dann endlos; erst nach der Ausgabe, sonst bliebe die Zeile im Puffer
process.stdout.write('{"ready":true}\n', () => {
  for (;;) {
    // endlos
  }
})
