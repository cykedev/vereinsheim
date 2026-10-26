// meldet sich bereit und endet ohne Ergebnis mit Code 3
process.stdout.write('{"ready":true}\n', () => process.exit(3))
