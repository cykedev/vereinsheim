// Erzeugt kleine, gültige PDFs für die Tests, nach den zwei Druckwegen von Meyton: Ghostscript mit
// einer Type1-Schrift und Literal-Strings, Qt mit einer Type0-Schrift (Identity-H), ToUnicode und einem
// Glyph je `Tj`. Dazu Info-Dict, XMP, mehrere Seiten und frei positionierter Text, für die Grenzen
// außerdem präparierte Inhaltsströme (`bombContent`). Echte Ausdrucke gehören nicht ins Repo (ADR-029);
// die Fälle hier sind erfunden und ohne Namen.

export interface TestText {
  str: string
  x: number
  y: number
  size?: number
}

export interface TestPdf {
  pages: TestText[][]
  /** "type1": Helvetica mit Literal-Strings (Ghostscript); "identity-h": ein Glyph je Tj (Qt) */
  font?: "type1" | "identity-h"
  /** Vorschub zwischen einzeln gesetzten Glyphen in Em (nur identity-h); 0,5 ist lückenlos */
  glyphAdvance?: number
  /** Info-Dict, etwa { CreationDate: "D:20261002195212+02'00'", Producer: "Qt 5.12.8" }; null = keins */
  info?: Record<string, string> | null
  /** XMP-Strom mit <xmp:CreateDate> als Element */
  xmpCreateDate?: string
  /** Präfix im XMP; ältere Erzeuger schreiben "xap" */
  xmpPrefix?: "xmp" | "xap"
  /** fertige Inhaltsströme je Seite statt des Texts aus `pages`; werden ebenso deflatet */
  rawPages?: Uint8Array[]
}

const encoder = new TextEncoder()

/**
 * Ein erfundener Inhaltsstrom, der pdf.js an eine Grenze bringt, deflatet aber klein bleibt:
 * - "memory": ein String aus 32 MiB · `scale` Zeichen; der Lexer von pdf.js baut ihn als Array
 *   einzelner Zeichen (rund 8 Byte je Zeichen).
 * - "time": 10 Millionen · `scale` leere Operatorpaare `q Q`.
 */
export function bombContent(kind: "memory" | "time", scale = 1): Uint8Array {
  if (kind === "memory") {
    const length = Math.round(32 * 1024 * 1024 * scale)
    const head = latin1("BT /F1 8 Tf (")
    const tail = latin1(") Tj ET")
    const out = new Uint8Array(head.length + length + tail.length)
    out.set(head)
    out.fill(0x41, head.length, head.length + length)
    out.set(tail, head.length + length)
    return out
  }
  const op = latin1("q Q\n")
  const count = Math.round(10_000_000 * scale)
  const out = new Uint8Array(op.length * count)
  for (let i = 0; i < count; i++) out.set(op, i * op.length)
  return out
}

/** Latin-1-Bytes; Zeichen außerhalb werden zu "?" */
function latin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes[i] = code <= 0xff ? code : 0x3f
  }
  return bytes
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("deflate"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const escapeLiteral = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
const hex4 = (value: number) => value.toString(16).padStart(4, "0").toUpperCase()
const num = (value: number) => Number(value.toFixed(2)).toString()

function stream(dict: string, data: Uint8Array): Uint8Array {
  return concat([
    latin1(`<<${dict}/Length ${data.length}>>\nstream\n`),
    data,
    latin1("\nendstream"),
  ])
}

function toUnicodeCMap(cids: Map<string, number>): Uint8Array {
  const entries = [...cids].map(([char, cid]) => `<${hex4(cid)}> <${hex4(char.charCodeAt(0))}>`)
  const blocks: string[] = []
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100)
    blocks.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`)
  }
  return latin1(
    [
      "/CIDInit /ProcSet findresource begin",
      "12 dict begin",
      "begincmap",
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
      "/CMapName /Adobe-Identity-UCS def",
      "/CMapType 2 def",
      "1 begincodespacerange",
      "<0000> <FFFF>",
      "endcodespacerange",
      ...blocks,
      "endcmap",
      "CMapName currentdict /CMap defineresource pop",
      "end",
      "end",
    ].join("\n")
  )
}

function xmpPacket(createDate: string, prefix: "xmp" | "xap"): Uint8Array {
  return encoder.encode(
    [
      '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>',
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
      `<rdf:Description rdf:about="" xmlns:${prefix}="http://ns.adobe.com/xap/1.0/">`,
      `<${prefix}:CreateDate>${createDate}</${prefix}:CreateDate>`,
      "</rdf:Description>",
      "</rdf:RDF>",
      "</x:xmpmeta>",
      '<?xpacket end="w"?>',
    ].join("\n")
  )
}

export async function buildPdf(spec: TestPdf): Promise<Uint8Array> {
  const font = spec.font ?? "type1"
  const advance = spec.glyphAdvance ?? 0.5

  // Objekte der Reihe nach: Nummer = Index + 1.
  const objects: Uint8Array[] = []
  const add = (body: Uint8Array | string) => {
    objects.push(typeof body === "string" ? latin1(body) : body)
    return objects.length
  }
  const reserve = () => add("")
  const fill = (number: number, body: Uint8Array | string) => {
    objects[number - 1] = typeof body === "string" ? latin1(body) : body
  }

  const catalog = reserve()
  const pagesTree = reserve()

  // Schrift
  const cids = new Map<string, number>()
  let fontRef: number
  if (font === "type1") {
    fontRef = add("<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>")
  } else {
    for (const page of spec.pages) {
      for (const item of page) {
        for (const char of item.str) if (!cids.has(char)) cids.set(char, cids.size + 1)
      }
    }
    const descriptor = add(
      "<</Type/FontDescriptor/FontName/QtSans/Flags 32/FontBBox[0 -200 1000 800]/ItalicAngle 0/Ascent 800/Descent -200/CapHeight 700/StemV 80>>"
    )
    const descendant = add(
      `<</Type/Font/Subtype/CIDFontType2/BaseFont/QtSans/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>/FontDescriptor ${descriptor} 0 R/DW 500/CIDToGIDMap/Identity>>`
    )
    const toUnicode = add(stream("", toUnicodeCMap(cids)))
    fontRef = add(
      `<</Type/Font/Subtype/Type0/BaseFont/QtSans/Encoding/Identity-H/DescendantFonts[${descendant} 0 R]/ToUnicode ${toUnicode} 0 R>>`
    )
  }

  // Seiten
  const pageRefs: number[] = []
  for (const [index, page] of spec.pages.entries()) {
    const raw = spec.rawPages?.[index]
    const ops: string[] = []
    for (const item of page) {
      const size = item.size ?? 8
      ops.push(`BT /F1 ${num(size)} Tf`)
      if (font === "type1") {
        ops.push(`1 0 0 1 ${num(item.x)} ${num(item.y)} Tm (${escapeLiteral(item.str)}) Tj`)
      } else {
        const glyphs = [...item.str]
        glyphs.forEach((char, i) => {
          const x = item.x + i * advance * size
          ops.push(`1 0 0 1 ${num(x)} ${num(item.y)} Tm <${hex4(cids.get(char) ?? 0)}> Tj`)
        })
      }
      ops.push("ET")
    }
    const content = raw ?? latin1(ops.join("\n"))
    const contents = add(stream("/Filter/FlateDecode", await deflate(content)))
    pageRefs.push(
      add(
        `<</Type/Page/Parent ${pagesTree} 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 ${fontRef} 0 R>>>>/Contents ${contents} 0 R>>`
      )
    )
  }
  fill(
    pagesTree,
    `<</Type/Pages/Kids[${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}]/Count ${pageRefs.length}>>`
  )

  const metadata =
    spec.xmpCreateDate === undefined
      ? null
      : add(
          stream(
            "/Type/Metadata/Subtype/XML",
            xmpPacket(spec.xmpCreateDate, spec.xmpPrefix ?? "xmp")
          )
        )
  fill(
    catalog,
    `<</Type/Catalog/Pages ${pagesTree} 0 R${metadata === null ? "" : `/Metadata ${metadata} 0 R`}>>`
  )

  const info =
    spec.info === null || spec.info === undefined
      ? null
      : add(
          `<<${Object.entries(spec.info)
            .map(([key, value]) => `/${key} (${escapeLiteral(value)})`)
            .join("")}>>`
        )

  // Datei mit Querverweistabelle
  const chunks: Uint8Array[] = [latin1("%PDF-1.4\n")]
  const offsets: number[] = []
  let position = chunks[0].length
  objects.forEach((body, index) => {
    offsets.push(position)
    for (const part of [latin1(`${index + 1} 0 obj\n`), body, latin1("\nendobj\n")]) {
      chunks.push(part)
      position += part.length
    }
  })
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`
  xref += `trailer\n<</Size ${objects.length + 1}/Root ${catalog} 0 R${info === null ? "" : `/Info ${info} 0 R`}>>\nstartxref\n${position}\n%%EOF\n`
  chunks.push(latin1(xref))
  return concat(chunks)
}
