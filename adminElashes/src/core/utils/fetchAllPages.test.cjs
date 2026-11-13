// node --test src/core/utils/fetchAllPages.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, 'fetchAllPages.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { fetchAllPages } = exportsObject;

// Fuente falsa con `total` filas que respeta skip/limit como el backend.
const source = (total, calls = []) => async (skip, limit) => {
  calls.push([skip, limit]);
  return Array.from({ length: Math.max(0, Math.min(limit, total - skip)) }, (_, i) => skip + i);
};

test('junta todas las páginas, sin cortar en el tamaño de página', async () => {
  const calls = [];
  const all = await fetchAllPages(source(450, calls), 200);
  assert.equal(all.length, 450);
  assert.deepEqual([...all.slice(0, 3)], [0, 1, 2]);
  assert.equal(all[449], 449);
  assert.deepEqual(calls, [[0, 200], [200, 200], [400, 200]]);
});

test('una sola página incompleta: una sola petición', async () => {
  const calls = [];
  assert.equal((await fetchAllPages(source(7, calls), 200)).length, 7);
  assert.equal(calls.length, 1);
});

test('cantidad exacta múltiplo del tamaño: pide una página más y termina vacía', async () => {
  const calls = [];
  assert.equal((await fetchAllPages(source(400, calls), 200)).length, 400);
  assert.equal(calls.length, 3);
});

test('vacío', async () => {
  assert.equal((await fetchAllPages(source(0), 200)).length, 0);
});

test('freno de seguridad si el servidor ignora skip (siempre devuelve lo mismo)', async () => {
  let calls = 0;
  const stuck = async (_skip, limit) => { calls += 1; return Array.from({ length: limit }, (_, i) => i); };
  const all = await fetchAllPages(stuck, 100, 4);
  assert.equal(calls, 4);
  assert.equal(all.length, 400);
});

test('un error de una página se propaga (no devuelve datos a medias)', async () => {
  let n = 0;
  const flaky = async (skip, limit) => { n += 1; if (n === 2) throw new Error('boom'); return Array.from({ length: limit }, (_, i) => skip + i); };
  await assert.rejects(fetchAllPages(flaky, 10), /boom/);
});
