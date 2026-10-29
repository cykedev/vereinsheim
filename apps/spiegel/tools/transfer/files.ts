// Die Dateien der Anhänge aus Treffsicher: ein Ordner unter `tools/private/` (gitignored), in den der Betreiber das
// Backup entpackt. Gelesen wird nur darin; ein Pfad, der über einen Link oder `..` hinausführt, gilt als fehlend.

import { readFile, realpath } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"

import type { AttachmentFiles } from "../../src/parts/transfer/run"

const inside = (root: string, path: string) => {
  const rel = relative(root, path)
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)
}

/** der Ordner `dir` als Quelle der Anhänge; wirft, wenn er nicht unter `privateRoot` liegt */
export async function filesUnder(dir: string, privateRoot: string): Promise<AttachmentFiles> {
  const allowed = await realpath(privateRoot)
  const root = await realpath(resolve(dir))
  if (!inside(allowed, root)) throw new Error("--files nur für einen Ordner unter tools/private/")
  return {
    async read(filePath) {
      try {
        const real = await realpath(join(root, ...filePath.split("/")))
        if (!inside(root, real)) return null
        return new Uint8Array(await readFile(real))
      } catch {
        return null
      }
    },
  }
}
