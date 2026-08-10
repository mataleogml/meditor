// Public entry for the "meditor/api" subpath: the HTTP handler factory (server)
// and the typed client (browser-safe) for the editor's REST API.
export { createMeditorApi, type MeditorApiOptions } from "./routes";
export { createMeditorClient, MeditorApiError, type MeditorClient, type MeditorClientOptions } from "./client";
