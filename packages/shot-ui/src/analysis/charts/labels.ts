/** Eine Beschriftung: Mittelpunkt in Pixeln und ihre Breite */
export interface LabelBox {
  x: number
  y: number
  width: number
}

/**
 * Beschriftungen ohne Überlappung (Probe auf der Scheibe): jede möglichst auf ihrem Punkt. Überlappt sie eine
 * schon gesetzte, rückt sie um eine Zeilenhöhe nach unten, dann nach oben, dann zwei Zeilen, bis sie frei ist
 * (höchstens drei Zeilen weit, sonst bleibt sie auf dem Punkt). In der gegebenen Reihenfolge: Die frühere
 * bleibt, die spätere weicht aus.
 */
export function placeLabels(
  items: readonly LabelBox[],
  height: number
): { x: number; y: number }[] {
  const placed: LabelBox[] = []
  const offsets = [0, 1, -1, 2, -2, 3, -3]
  return items.map((item) => {
    const free = (y: number) =>
      placed.every(
        (other) =>
          Math.abs(other.x - item.x) >= (other.width + item.width) / 2 ||
          Math.abs(other.y - y) >= height
      )
    const step = offsets.find((k) => free(item.y + k * height)) ?? 0
    const at = { x: item.x, y: item.y + step * height, width: item.width }
    placed.push(at)
    return { x: at.x, y: at.y }
  })
}
