/**
 * Vertragsversionen (SF-69). Brücken im Feld werden nicht gleichzeitig aktualisiert; Spiegel nimmt
 * deshalb immer die aktuelle **und** die vorige Version an. Änderungen am Vertrag sind nur additiv;
 * erzwungen wird das über die eingefrorenen Beispiele unter `examples/v<n>/`.
 */
export const CURRENT_CONTRACT_VERSION = 1

export const SUPPORTED_CONTRACT_VERSIONS: readonly number[] = [1]

export function isSupportedContractVersion(version: unknown): version is number {
  return typeof version === "number" && SUPPORTED_CONTRACT_VERSIONS.includes(version)
}
