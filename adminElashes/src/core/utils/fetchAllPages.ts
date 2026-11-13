/**
 * Carga TODAS las páginas de un listado paginado (skip/limit) y las junta.
 *
 * Pedir un `limit` fijo (200, 500…) y dar la lista por completa corta los datos en
 * silencio cuando crece: en un reporte de comisiones eso deja fuera tickets y cambia
 * los totales. Esto sigue pidiendo páginas hasta que una viene incompleta.
 *
 * `maxPages` es solo un freno de seguridad ante un servidor que ignore `skip`
 * (devolvería siempre lo mismo y el bucle no terminaría): con página de 200 son 5000
 * filas, bastante más de lo que este panel maneja.
 */
export async function fetchAllPages<T>(
  fetchPage: (skip: number, limit: number) => Promise<T[]>,
  pageSize = 200,
  maxPages = 25,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchPage(page * pageSize, pageSize);
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}
