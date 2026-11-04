const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.join(__dirname, 'followupState.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = new Module(file, module);
mod._compile(compiled, file);
const { followupState, followupRowId } = mod.exports;

test('pending booking without tracking renders Pendiente de atención', () => {
  const row = { estado_seguimiento: 'pendiente_atencion', seguimiento_id: null, appointment_id: 7, tipo: 'retiro', vencido: false };
  assert.equal(followupState(row).label, 'Pendiente de atención');
  assert.equal(followupRowId(row), 'a7-retiro');
});
test('in service is still pending', () => {
  const row = { estado_seguimiento: 'pendiente_atencion', seguimiento_id: null, appointment_id: 7, tipo: 'mantenimiento', cita_estado: 'in_service' };
  assert.equal(followupState(row).key, 'pendiente_atencion');
  assert.match(followupState(row).label, /En servicio/);
});
test('each backend state has a distinct label', () => {
  const labels = ['pendiente_atencion', 'habilitado', 'recordatorio_enviado', 'vencido', 'cancelado']
    .map((estado_seguimiento) => followupState({ estado_seguimiento, seguimiento_id: 1, tipo: 'mantenimiento' }).label);
  assert.deepEqual(labels, ['Pendiente de atención', 'Seguimiento habilitado', 'Recordatorio enviado', 'Vencido', 'Cancelado']);
});
test('tracking rows keep one id per tracking and type (no duplicates)', () => {
  assert.equal(followupRowId({ seguimiento_id: 3, appointment_id: 9, tipo: 'mantenimiento' }), 't3-mantenimiento');
  assert.notEqual(followupRowId({ seguimiento_id: 3, tipo: 'retiro' }), followupRowId({ seguimiento_id: 3, tipo: 'mantenimiento' }));
});
test('older responses without estado fall back by data', () => {
  assert.equal(followupState({ seguimiento_id: 1, vencido: true }).key, 'vencido');
  assert.equal(followupState({ seguimiento_id: 1, vencido: false }).key, 'habilitado');
});
