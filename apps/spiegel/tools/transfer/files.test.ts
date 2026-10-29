import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { filesUnder } from "./files"

let base: string
let privateRoot: string
let uploads: string

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "transfer-files-"))
  privateRoot = join(base, "private")
  uploads = join(privateRoot, "uploads")
  await mkdir(join(uploads, "sub"), { recursive: true })
  await writeFile(join(uploads, "a.pdf"), "%PDF-a")
  await writeFile(join(uploads, "sub", "b.jpg"), "b")
  await writeFile(join(base, "geheim.txt"), "geheim")
  await symlink(join(base, "geheim.txt"), join(uploads, "link.txt"))
})

afterAll(async () => {
  await rm(base, { recursive: true, force: true })
})

describe("filesUnder", () => {
  it("liest Dateien im Ordner, auch in Unterordnern", async () => {
    const files = await filesUnder(uploads, privateRoot)
    expect(new TextDecoder().decode((await files.read("a.pdf"))!)).toBe("%PDF-a")
    expect(await files.read("sub/b.jpg")).not.toBeNull()
  })

  it("eine fehlende Datei, `..` oder ein Link nach draußen gelten als fehlend", async () => {
    const files = await filesUnder(uploads, privateRoot)
    expect(await files.read("fehlt.pdf")).toBeNull()
    expect(await files.read("../../geheim.txt")).toBeNull()
    expect(await files.read("link.txt")).toBeNull()
  })

  it("nur ein Ordner unter dem privaten Ordner", async () => {
    await expect(filesUnder(base, privateRoot)).rejects.toThrow()
    await expect(filesUnder(privateRoot, privateRoot)).rejects.toThrow()
  })
})
