// node --test src/pages/admin/pos/pos.context.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, 'pos.context.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { PosContext, posDraftKey, persistPosDraft } = exportsObject;
const cashier = effective => ({ id: 1, role: { name: 'Cajera' }, branch_id: 10, effective_branch_id: effective });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('normal, transferred and expired cashier use only the server effective branch', async () => {
  for (const branch of [10, 20, 10]) {
    const context = new PosContext(1, async () => cashier(branch), () => 99);
    assert.equal(await context.refresh(), true);
    assert.equal(context.state.branchId, branch);
    let writes = 0;
    await context.runWrite(async () => { writes++; });
    assert.equal(writes, 1);
  }
});

test('Admin, SuperAdmin and Secretaria preserve multibranch selection', async () => {
  for (const role of ['Admin', 'SuperAdmin', 'Secretaria']) {
    for (const selected of [null, 30]) {
      const context = new PosContext(1, async () => ({ ...cashier(20), role }), () => selected);
      await context.refresh();
      assert.equal(context.state.branchId, selected);
      assert.equal(context.state.multibranch, true);
    }
  }
});

test('double confirmation is excluded before the first await, through completion', async () => {
  const verification = deferred(), operation = deferred();
  let calls = 0, writes = 0;
  const context = new PosContext(1, () => ++calls === 1 ? Promise.resolve(cashier(20)) : verification.promise, () => 99);
  await context.refresh();
  const first = context.runWrite(async () => { writes++; await operation.promise; });
  const second = context.runWrite(async () => { writes++; });
  assert.equal(context.state.busy, true);
  await second;
  verification.resolve(cashier(20));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 1);
  await context.runWrite(async () => { writes++; });
  assert.equal(writes, 1);
  operation.resolve();
  await first;
  assert.equal(calls, 2);
  assert.equal(context.state.busy, false);
});

test('concurrent verification requests are shared', async () => {
  const response = deferred(); let calls = 0;
  const context = new PosContext(1, () => { calls++; return response.promise; }, () => null);
  const first = context.refresh(), second = context.refresh();
  assert.equal(first, second);
  response.resolve(cashier(20)); await first;
  assert.equal(calls, 1);
});

test('a late response from an invalidated session cannot overwrite newer context', async () => {
  const old = deferred(), fresh = deferred(); let calls = 0;
  const context = new PosContext(1, () => ++calls === 1 ? old.promise : fresh.promise, () => null);
  const a = context.refresh(); await Promise.resolve();
  context.invalidate();
  const b = context.refresh(); await Promise.resolve();
  fresh.resolve(cashier(20)); await b;
  old.resolve(cashier(10)); await a;
  assert.equal(context.state.branchId, 20);
  assert.equal(context.state.verified, true);
});

test('network failure keeps branch and draft; writes fail closed and recover', async () => {
  let online = true;
  const context = new PosContext(1, async () => { if (!online) throw Error('offline'); return cashier(20); }, () => null);
  await context.refresh();
  const key = posDraftKey(1, context.state.branchId);
  const storage = new Map([[key, '{"cartLines":["pending"]}']]);
  online = false;
  await assert.rejects(context.runWrite(async () => assert.fail('write must not run')));
  assert.equal(context.state.branchId, 20);
  assert.equal(posDraftKey(1, context.state.branchId), key);
  assert.equal(storage.get(key), '{"cartLines":["pending"]}');
  assert.equal(context.state.busy, false);
  online = true;
  let writes = 0;
  await context.runWrite(async () => { writes++; });
  assert.equal(writes, 1);
  assert.equal(context.state.error, '');
});

test('branch changes require explicit acceptance, preserving the old user/branch draft', async () => {
  let branch = 10;
  const context = new PosContext(1, async () => cashier(branch), () => null);
  await context.refresh();
  const oldKey = posDraftKey(1, 10), newKey = posDraftKey(1, 20);
  const storage = new Map([[oldKey, 'old cart'], [newKey, 'destination cart']]);
  branch = 20; await context.refresh();
  assert.equal(context.state.branchId, 10);
  assert.equal(context.state.pendingBranchId, 20);
  await assert.rejects(context.runWrite(async () => assert.fail('cannot write old context')));
  context.acceptChange();
  assert.equal(context.state.branchId, 20);
  assert.equal(storage.get(oldKey), 'old cart');
  assert.equal(storage.get(newKey), 'destination cart');
  assert.notEqual(posDraftKey(2, 20), newKey);
});

test('focus/selection refresh during an operation is deferred; no branch switch mid-write', async () => {
  let branch = 10;
  const operation = deferred();
  const context = new PosContext(1, async () => cashier(branch), () => null);
  await context.refresh();
  const write = context.runWrite(async () => {
    branch = 20;
    await context.refresh();
    context.acceptChange();
    assert.equal(context.state.branchId, 10);
    await operation.promise;
  });
  await new Promise(resolve => setImmediate(resolve));
  operation.resolve(); await write;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.state.branchId, 10);
  assert.equal(context.state.pendingBranchId, 20);
  assert.equal(context.state.changed, true);
});

test('changed identity or absent effective branch never authorize a write', async () => {
  for (const profile of [{ ...cashier(20), id: 2 }, cashier(null)]) {
    const context = new PosContext(1, async () => profile, () => 99);
    await assert.rejects(context.runWrite(async () => assert.fail('must not write')));
    assert.equal(context.state.verified, false);
  }
});

test('draft persistence cannot copy a previous user/branch cart during hydration', () => {
  const previous = posDraftKey(1, 10), next = posDraftKey(1, 20), anotherUser = posDraftKey(2, 20);
  const values = new Map([[previous, 'original'], [next, 'destination'], [anotherUser, 'other user']]);
  const storage = { setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  persistPosDraft(storage, next, previous, { cartLines: ['old branch'] }, false);
  persistPosDraft(storage, next, null, {}, true);
  assert.equal(values.get(next), 'destination');
  persistPosDraft(storage, next, next, { cartLines: ['new branch'] }, false);
  assert.equal(JSON.parse(values.get(next)).cartLines[0], 'new branch');
  assert.equal(values.get(previous), 'original');
  assert.equal(values.get(anotherUser), 'other user');
});

test('all write callbacks exposed by the POS pass through the same synchronous gate', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'usePosPage.ts'), 'utf8');
  const ast = ts.createSourceFile('usePosPage.ts', source, ts.ScriptTarget.Latest, true);
  const names = ['handleOpenCashSessionFromPos', 'handleCloseCashSessionFromPos', 'handleImmediateCheckout',
    'handleCheckout', 'saveSingleReceiptTicketEdit', 'saveReceiptTicketEdits', 'handleRegisterClientSubmit',
    'executeCancelSale', 'executeDeleteSale'];
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) declarations.set(node.name.getText(ast), node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const name of names) {
    assert.ok(declarations.has(name), name);
    const verification = deferred(); let writes = 0;
    const context = new PosContext(1, async () => cashier(20), () => null);
    await context.refresh();
    const scope = { exports: {}, runWrite: operation => context.runWrite(operation),
      [name + 'Impl']: async () => { writes++; await verification.promise; } };
    vm.runInNewContext(ts.transpileModule('exports.run = ' + declarations.get(name), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, scope);
    const first = scope.exports.run();
    await scope.exports.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes, 1, name);
    verification.resolve(); await first;
  }
});
