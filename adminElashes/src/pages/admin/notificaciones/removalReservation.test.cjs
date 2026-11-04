const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'removalReservation.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = new Module(file, module);
mod._compile(compiled, file);
const { removalReservation } = mod.exports;

test('no future appointment renders Sin reserva', () => {
  assert.equal(removalReservation({ proxima_cita: null }).label, 'Sin reserva');
});
test('unclassified future appointment never renders Reservado', () => {
  const row = { proxima_cita: '2026-11-06T11:00:00', reserva_retiro_estado: 'por_verificar' };
  assert.equal(removalReservation(row).label, 'Por verificar');
  assert.equal(removalReservation(row).date, null);
});
test('verified reservation contract renders Reservado and the current date', () => {
  // A simulated verified backend contract, NOT a claim that current DB fields
  // can identify removal services. No classifications are added to production.
  const row = { reserva_retiro_estado: 'reservado', reserva_retiro_fecha: '2026-11-06T11:00:00' };
  assert.equal(removalReservation(row).label, 'Reservado');
  assert.equal(removalReservation(row).date, row.reserva_retiro_fecha);
  row.reserva_retiro_fecha = '2026-11-09T12:00:00';
  assert.equal(removalReservation(row).date, row.reserva_retiro_fecha);
});
test('a reserved flag without date remains Por verificar', () => {
  assert.equal(removalReservation({ reserva_retiro_estado: 'reservado' }).label, 'Por verificar');
});
