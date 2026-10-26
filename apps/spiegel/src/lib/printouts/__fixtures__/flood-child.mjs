// meldet sich bereit und schreibt dann 1 MiB statt einer Zeile
process.stdout.write('{"ready":true}\n')
process.stdout.write("x".repeat(1024 * 1024))
