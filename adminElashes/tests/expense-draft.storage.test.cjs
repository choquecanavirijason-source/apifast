const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync("src/core/services/expense/expense-draft.storage.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let api, storage;
beforeEach(() => {
  storage = new Map();
  const exports = {};
  vm.runInNewContext(code, { exports, File, Uint8Array, atob,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  api = exports;
});
const row = { id: "test-1", expense_date: "2026-10-23", amount: 25.5,
  description: "Insumos", photoDataUrl: null, photoName: null };
test("recupera los importes y descripciones después de serializar el borrador", () => {
  const key = api.expenseDraftKey(1, 2);
  api.writeExpenseDraft(key, [row]);
  const recovered = JSON.parse(JSON.stringify(api.readExpenseDraft(key)));
  assert.deepEqual(recovered, [row]);
});
test("separa usuario y sucursal", () => {
  api.writeExpenseDraft(api.expenseDraftKey(1, 2), [row]);
  assert.equal(api.readExpenseDraft(api.expenseDraftKey(2, 2)).length, 0);
  assert.equal(api.readExpenseDraft(api.expenseDraftKey(1, 3)).length, 0);
  assert.equal(api.readExpenseDraft(api.expenseDraftKey(1, null)).length, 0);
});
test("retirar un éxito conserva el gasto que falló y limpiar borra la clave", () => {
  const key = api.expenseDraftKey(1, 2);
  api.writeExpenseDraft(key, [row, { ...row, id: "test-2" }]);
  api.writeExpenseDraft(key, api.readExpenseDraft(key).filter((r) => r.id !== row.id));
  assert.equal(api.readExpenseDraft(key)[0].id, "test-2");
  api.writeExpenseDraft(key, []);
  assert.equal(storage.has(key), false);
});
test("recupera los bytes, nombre y tipo del comprobante después de recargar", async () => {
  const photo = { ...row, photoDataUrl: "data:image/png;base64,AQIDBA==", photoName: "recibo.png" };
  api.writeExpenseDraft("photo", [photo]);
  const file = api.restoreExpensePhoto(api.readExpenseDraft("photo")[0]);
  assert.equal(file.name, "recibo.png");
  assert.equal(file.type, "image/png");
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3, 4]);
  assert.equal(api.restoreExpensePhoto(row), null);
});
test("un borrador corrupto genera error y no se sobrescribe", () => {
  storage.set("bad", "{corrupto");
  assert.throws(() => api.readExpenseDraft("bad"));
  assert.equal(storage.get("bad"), "{corrupto");
  storage.set("bad", JSON.stringify([{ ...row, amount: -5 }]));
  assert.throws(() => api.readExpenseDraft("bad"));
});
