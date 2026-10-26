// meldet sich bereit und belegt dann Speicher, bis der Heap voll ist
process.stdout.write('{"ready":true}\n', () => {
  const blocks = []
  for (;;) blocks.push(new Array(1e6).fill(1))
})
