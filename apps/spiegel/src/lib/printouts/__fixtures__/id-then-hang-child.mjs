// meldet ID und Druckzeit wie der echte Kindprozess und rechnet dann bei den Werten endlos
const result = {
  ok: true,
  pages: 1,
  id: { kind: "found", hex: "ff914420", value: -7257056, pages: [1] },
  createdAt: {
    local: "2026-10-02T19:52:12",
    offsetMinutes: 120,
    epochMs: 1790963532000,
    source: "info",
  },
  producer: "Qt 5.12.8",
  maxRssKb: 1,
}
process.stdout.write('{"ready":true}\n')
process.stdin.on("data", () => {})
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify(result) + "\n", () => {
    for (;;) {
      // endlos
    }
  })
})
