const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function moduleFrom(source, scope = {}) {
  scope.exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, scope);
  return scope.exports;
}
const { PosContext } = moduleFrom(fs.readFileSync(path.join(__dirname, 'pos.context.ts'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, '../control-de-servicios/Queue.tsx'), 'utf8');
const ast = ts.createSourceFile('Queue.tsx', source, ts.ScriptTarget.Latest, true);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.initializer) declarations.set(node.name.getText(ast), node.initializer.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
function gate(context, branch = 20) {
  const warnings = [];
  const scope = { operationalContext: context, activeBranchId: branch,
    loadTicketsRequestIdRef: { current: 0 }, toast: { warning: message => warnings.push(message) } };
  return { run: moduleFrom('exports.run = ' + declarations.get('runQueueWrite'), scope).run, warnings };
}

test('embedded Queue shares the POS lock, rejects stale tickets and preserves standalone writes', async () => {
  let branch = 20;
  const context = new PosContext(1, async () => ({ id: 1, role: 'Cajera', effective_branch_id: branch }), () => 99);
  await context.refresh();
  const { run, warnings } = gate(context);
  let writes = 0, release;
  const held = new Promise(resolve => { release = resolve; });
  const first = run(async () => { writes++; await held; }, { branch_id: 20 });
  await run(async () => { writes++; }, { branch_id: 20 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 1);
  branch = 10;
  await context.refresh();
  assert.equal(context.state.branchId, 20);
  release(); await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.state.changed, true);
  await run(async () => { writes++; }, { branch_id: 20 });
  assert.equal(writes, 1);
  context.acceptChange();
  await gate(context, 10).run(async () => { writes++; }, { branch_id: 20 });
  assert.equal(writes, 1);
  assert(warnings.length > 0);
  await gate(undefined).run(async () => { writes++; }, { branch_id: 99 });
  assert.equal(writes, 2);
});

test('every Queue write callback enters the same gate before invoking its implementation', async () => {
  const names = ['handleNoShow', 'handleCancelTicket', 'handleStartService', 'handleFinishService',
    'handleDragEnd', 'handleMarkCompleted', 'handleSaveTicketEdits', 'handleChangeTicketClient',
    'handleRegisterClientSubmit', 'handleConfirmDelete'];
  for (const name of names) {
    let checked = false, writes = 0;
    const scope = { runQueueWrite: async operation => { checked = true; return operation(); },
      finishTarget: {}, activeDragTicket: {}, registerClientTarget: {}, ticketToDelete: {},
      [name + 'Impl']: async () => { assert(checked, name); writes++; } };
    const run = moduleFrom('exports.run = ' + declarations.get(name), scope).run;
    await run({ branch_id: 20 }, {});
    assert.equal(writes, 1, name);
  }
});

test('expired, unassigned and multibranch users retain server-driven Queue policy', async () => {
  for (const role of ['Cajera', 'Operaria', 'Admin', 'SuperAdmin', 'Secretaria']) {
    let effective = 20;
    const context = new PosContext(1, async () => ({ id: 1, role, effective_branch_id: effective }), () => 30);
    await context.refresh();
    const multibranch = ['Admin', 'SuperAdmin', 'Secretaria'].includes(role);
    assert.equal(context.state.branchId, multibranch ? 30 : 20);
    effective = 10; await context.refresh();
    if (!multibranch) { assert(context.state.changed); context.acceptChange(); }
    assert.equal(context.state.branchId, multibranch ? 30 : 10);
    effective = null;
    let writes = 0;
    await gate(context, context.state.branchId).run(async () => { writes++; });
    assert.equal(writes, multibranch ? 1 : 0);
  }
});

test('late Queue ticket responses cannot overwrite the new operational branch', async () => {
  const requests = [];
  const shown = [];
  const branchRef = { current: 20 };
  const sequence = { current: 0 };
  function loader(branch) {
    return moduleFrom('exports.run = ' + declarations.get('loadTickets'), {
      useCallback: fn => fn, activeBranchId: branch, filterDate: '',
      operationalContext: { state: { initialized: true } }, branchRef,
      loadTicketsRequestIdRef: sequence, todayDate: () => '2030-01-15',
      SHOW_ALL_DATES_FOR_TESTING: true, REFRESH_INTERVAL: 45,
      AgendaService: { listTickets: () => new Promise(resolve => requests.push(resolve)) },
      setIsLoading: () => {}, setTickets: value => shown.push(value),
      setLastRefresh: () => {}, setCountdown: () => {}, toast: { error: () => {} }, console,
    }).run;
  }
  const old = loader(20)();
  branchRef.current = 10;
  const current = loader(10)();
  requests[1]([{ id: 2, branch_id: 10 }]); await current;
  requests[0]([{ id: 1, branch_id: 20 }]); await old;
  assert.equal(shown.length, 1);
  assert.equal(shown[0][0].branch_id, 10);
});
