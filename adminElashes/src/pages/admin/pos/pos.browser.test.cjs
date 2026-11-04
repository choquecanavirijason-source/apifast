// React hook integration in a real browser, with ALL services mocked (no backend).
// node --test src/pages/admin/pos/pos.browser.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

test('React POS preserves drafts, recovers from network failure and excludes duplicate sale submissions', async () => {
  const root = path.resolve(__dirname, '../../../..');
  const bundle = await esbuild.build({
    absWorkingDir: root, write: false, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { Provider } from 'react-redux';
      import { configureStore } from '@reduxjs/toolkit';
      import { MemoryRouter } from 'react-router-dom';
      import { usePosPage } from './src/pages/admin/pos/usePosPage';
      const store = configureStore({reducer: () => ({auth: {user: {id: 1}}})});
      function Harness() {
        const pos = usePosPage({embedded: true});
        globalThis.pos = pos;
        return <div>{pos.branchContext.error || 'POS ready'}</div>;
      }
      createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><Harness /></MemoryRouter></Provider>);
    ` },
    plugins: [{ name: 'isolated-pos-services', setup(build) {
      build.onResolve({ filter: /^react-toastify$/ }, () => ({ path: 'toast', namespace: 'probe' }));
      build.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({ contents: 'export const toast = new Proxy({}, {get: () => () => {}});' }));
      build.onLoad({ filter: /core[\\/]hooks[\\/]useWebSocket\.ts$/ }, () => ({ contents: 'export const useWebSocket = () => {};' }));
      build.onLoad({ filter: /core[\\/]services[\\/]api\.ts$/ }, () => ({ contents: 'export default {get: async () => ({data: await globalThis.probe.profile()})};' }));
      for (const [file, name] of [['agenda', 'AgendaService'], ['pos-sale', 'PosSaleService'],
        ['client', 'ClientService'], ['branch', 'BranchService'], ['cash-session', 'CashSessionService'], ['product', 'ProductService']]) {
        build.onLoad({ filter: new RegExp('core[\\\\/]services[\\\\/]' + file + '[\\\\/].*\\.ts$') }, () => ({
          contents: `export const ${name} = new Proxy({}, {get: (_, method) => (...args) => globalThis.probe.call('${name}', method, args)});
          export const deriveServiceCategoriesFromServices = () => [];
          export const getApiErrorMessage = (_, fallback) => fallback;`,
        }));
      }
    } }],
  });
  const executablePath = process.env.POS_TEST_BROWSER ||
    (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The only document is supplied in memory; every other network request aborts.
    await page.route('**/*', route => route.request().url() === 'http://pos.test/'
      ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort());
    await page.goto('http://pos.test/');
    await page.evaluate(() => {
      localStorage.setItem('selected_branch_id', '99');
      localStorage.setItem('pos-sale-draft-v2:1:10', JSON.stringify({notes: 'home saved'}));
      globalThis.probe = {
        effective: 20, offline: false, holdProfile: false, calls: [], sales: [],
        product: {id: 1, name: 'Probe', sku: 'PROBE', stock: 5, price: 25, active: true},
        async profile() {
          if (this.holdProfile) await new Promise(resolve => { this.release = resolve; });
          if (this.offline) throw Error('offline');
          return {id: 1, role: {name: 'Cajera'}, branch_id: 10, effective_branch_id: this.effective};
        },
        async call(service, method, args) {
          this.calls.push({service, method, args});
          if (service === 'BranchService') return [{id:10,name:'Norte'}, {id:20,name:'Principal'}];
          if (service === 'ProductService' && method === 'listProducts') return [this.product];
          if (service === 'CashSessionService' && method === 'getCurrent') return {id:1,branch_id:this.effective,status:'open'};
          if (service === 'PosSaleService' && method === 'create') {
            this.sales.push(args[0]);
            return {id:1, sale_code:'PROBE-1', appointments:[], payments:[], product_lines:[], total:25};
          }
          return [];
        },
      };
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForFunction(() => globalThis.pos?.products.length === 1 && globalThis.pos.branchContext.initialized);
    assert.equal(await page.evaluate(() => pos.activeBranchId), 20);
    assert.equal(await page.evaluate(() => localStorage.getItem('selected_branch_id')), '99');
    await page.evaluate(() => pos.setNotes('destination pending'));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pos-sale-draft-v2:1:20') || '{}').notes === 'destination pending');
    await page.evaluate(async () => { probe.offline = true; await pos.handleCheckout(); pos.setActiveTab('history'); });
    assert.equal(await page.evaluate(() => pos.activeBranchId), 20);
    assert.equal(await page.evaluate(() => pos.activeTab), 'history');
    assert.equal(await page.evaluate(() => probe.sales.length), 0);
    await page.evaluate(async () => { probe.offline = false; probe.effective = 10; await pos.refreshBranch(); });
    assert.equal(await page.evaluate(() => pos.notes), 'destination pending');
    await page.evaluate(() => pos.acceptBranchChange());
    await page.waitForFunction(() => pos.activeBranchId === 10 && pos.notes === 'home saved');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pos-sale-draft-v2:1:20')).notes), 'destination pending');
    await page.evaluate(async () => { probe.effective = 20; await pos.refreshBranch(); });
    await page.evaluate(() => pos.acceptBranchChange());
    await page.waitForFunction(() => pos.activeBranchId === 20 && pos.notes === 'destination pending' && pos.products.length === 1);
    await page.evaluate(() => { pos.addProductToCart(probe.product); pos.setPaymentMethod('cash'); });
    await page.waitForFunction(() => pos.productLines.length === 1);
    await page.evaluate(() => {
      probe.holdProfile = true;
      globalThis.firstSale = pos.handleCheckout();
      globalThis.secondSale = pos.handleCheckout();
    });
    await page.waitForFunction(() => typeof probe.release === 'function');
    await page.evaluate(async () => {
      probe.holdProfile = false; probe.release();
      await Promise.all([firstSale, secondSale]);
    });
    assert.equal(await page.evaluate(() => probe.sales.length), 1);
    assert.equal(await page.evaluate(() => probe.sales[0].branch_id), 20);
    assert.equal(await page.evaluate(() => localStorage.getItem('selected_branch_id')), '99');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
