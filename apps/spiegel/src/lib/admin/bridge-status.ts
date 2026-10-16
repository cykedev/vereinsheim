import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"

/** Zustand einer Brücke aus ihrem letzten Heartbeat in Worten, für „Anlage und Brücke“ */
export const BRIDGE_STATUS_TEXT: Record<NonNullable<HeartbeatV1["status"]>, string> = {
  ok: "läuft",
  delayed: "schickt gerade langsamer als sonst",
  "db-unreachable": "erreicht die Meyton-Anlage nicht",
  "db-error": "bekommt Fehler von der Meyton-Anlage",
  "possible-reset": "Meyton-Anlage wirkt neu aufgesetzt (Spiegel regelt das selbst)",
  clock: "Uhr am Gerät geht falsch (schickt keine Scheiben, bis sie stimmt)",
}
