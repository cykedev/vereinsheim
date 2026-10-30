import { describe, expect, it } from "vitest"

import { argsOf } from "./args"

describe("argsOf", () => {
  it("nimmt `--from`, `--to` und die Schalter", () => {
    expect(
      argsOf([
        "--from",
        "a@example.com",
        "--to",
        "b@example.com",
        "--dry-run",
        "--files",
        "tools/private/treffsicher-uploads",
        "--family",
        "Luftgewehr (Zehntel)=lg-freihand",
        "--family",
        "LP Training vor RWK = lp-freihand",
        "--discipline",
        "Luftpistole=LP 60",
      ])
    ).toEqual({
      from: "a@example.com",
      to: "b@example.com",
      dryRun: true,
      files: "tools/private/treffsicher-uploads",
      families: [
        { name: "Luftgewehr (Zehntel)", slug: "lg-freihand" },
        { name: "LP Training vor RWK", slug: "lp-freihand" },
      ],
      disciplines: [{ name: "Luftpistole", target: "LP 60" }],
    })
  })

  it("ohne Schalter: echter Lauf, ohne Dateien, ohne Zuordnungen", () => {
    expect(argsOf(["--to", "b@example.com", "--from", "a@example.com"])).toEqual({
      from: "a@example.com",
      to: "b@example.com",
      dryRun: false,
      files: null,
      families: [],
      disciplines: [],
    })
  })

  it.each([
    [[]],
    [["--from", "a@example.com"]],
    [["--to", "b@example.com"]],
    [["--from", "--to", "b@example.com"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--delete"]],
    [["--from", "a@example.com", "--from", "c@example.com", "--to", "b@example.com"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--family", "ohne Kennung"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--family", "=lg"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--family", "LG="]],
    [["--from", "a@example.com", "--to", "b@example.com", "--discipline", "LP 60"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--discipline", "=LP 60"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--files"]],
    [["--from", "a@example.com", "--to", "b@example.com", "--files", "a", "--files", "b"]],
    [["--from", " ", "--to", "b@example.com"]],
  ])("lehnt %j ab", (argv) => {
    expect(argsOf(argv)).toBeNull()
  })
})
