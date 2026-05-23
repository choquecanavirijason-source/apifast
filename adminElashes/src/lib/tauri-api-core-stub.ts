/** Stub para `vite dev` en navegador (sin runtime Tauri). */
export async function invoke<T>(_cmd: string, _args?: Record<string, unknown>): Promise<T> {
  throw new Error("Tauri no está disponible en el navegador. Usa la app de escritorio o la descarga del PDF.");
}
