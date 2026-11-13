// node --test src/core/utils/birthDate.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, 'birthDate.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { ageFromBirthDate, validateBirthDate, todayIso, oldestBirthDateIso } = exportsObject;

test('la edad cuenta solo años cumplidos', () => {
  assert.equal(ageFromBirthDate('2000-06-15', '2026-06-14'), 25); // falta un día
  assert.equal(ageFromBirthDate('2000-06-15', '2026-06-15'), 26); // cumple hoy
  assert.equal(ageFromBirthDate('2026-01-01', '2026-11-13'), 0);  // bebé
  assert.equal(ageFromBirthDate('2000-02-29', '2026-02-28'), 25); // bisiesto, aún no cumple
  assert.equal(ageFromBirthDate('2000-02-29', '2026-03-01'), 26);
});

test('fechas inexistentes o mal escritas no tienen edad', () => {
  assert.equal(ageFromBirthDate('2001-02-31', '2026-11-13'), null);
  assert.equal(ageFromBirthDate('2001-13-01', '2026-11-13'), null);
  assert.equal(ageFromBirthDate('15/06/2000', '2026-11-13'), null);
  assert.equal(ageFromBirthDate('', '2026-11-13'), null);
});

test('validación: vacío vale, futura y de más de 100 años no', () => {
  const today = '2026-11-13';
  assert.equal(validateBirthDate('', today), '');
  assert.equal(validateBirthDate('1995-03-10', today), '');
  assert.equal(validateBirthDate(today, today), '');                       // nació hoy
  assert.match(validateBirthDate('2026-11-14', today), /futura/);
  assert.match(validateBirthDate('1900-01-01', today), /más de 100/);
  assert.equal(validateBirthDate('1926-11-12', today), '');                // 100 años y un día: aún 100 cumplidos
  assert.equal(validateBirthDate('1925-11-14', today), '');                // el más antiguo válido (100 cumplidos)
  assert.match(validateBirthDate('1925-11-13', today), /más de 100/);      // hoy cumple 101
  assert.match(validateBirthDate('2001-02-31', today), /no es válida/);
});

test('hoy y el límite antiguo son YYYY-MM-DD y el límite coincide con la validación', () => {
  const now = new Date(2026, 10, 13);
  assert.equal(todayIso(now), '2026-11-13');
  assert.equal(oldestBirthDateIso(now), '1925-11-14');
  // la fecha mínima que ofrece el calendario es válida y el día anterior no
  assert.equal(validateBirthDate(oldestBirthDateIso(now), todayIso(now)), '');
});
