// Einmal beim Start des Servers (nicht beim Build). Der Node-Teil liegt in einer eigenen Datei und wird nur in diesem
// Zweig geladen: Next bündelt instrumentation auch für Edge, und dort gibt es keine Datenbank (`pg` braucht `fs`).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node")
    await registerNode()
  }
}
