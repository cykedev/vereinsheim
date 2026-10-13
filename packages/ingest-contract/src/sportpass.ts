import { createHash } from "node:crypto"

/**
 * Gehashte SportpassID für die Liste der Zustimmungen (`GET /state`, SF-38): SHA-256 (Hex, klein) über
 * `spiegel-sportpass-v1:<salt>:<SportpassID dezimal ohne führende Nullen>`. Das Salz ist je Anlage fest und kommt mit
 * der Liste; der Hash hält die Nummern aus Logs und Mitschnitten heraus, schützt sie aber nicht vor jemandem, der die
 * Liste und das Salz hat (zwölf Stellen lassen sich durchprobieren). Testvektoren: `test-vectors/sportpass-v1.json`.
 */
export function sportpassHash(salt: string, sportpassId: bigint | number | string): string {
  const id = BigInt(sportpassId)
  if (id <= BigInt(0)) throw new RangeError("SportpassID muss positiv sein")
  return createHash("sha256")
    .update(`spiegel-sportpass-v1:${salt}:${id.toString(10)}`, "utf8")
    .digest("hex")
}
