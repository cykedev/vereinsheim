// Stub für das `server-only`-Paket in Vitest.
//
// `server-only` wirft beim Import, wenn nicht die `react-server`-Condition aktiv
// ist — im Node-Test-Runner ist sie das nie. Module wie
// `@vereinsheim/lib/dateTime` importieren es aber bewusst, damit sie nicht in
// einem Client-Bundle landen. Im Test ersetzt dieser Stub das Paket (Alias in
// `vitest.config.ts`), sodass server-seitige Module testbar bleiben.
export {}
