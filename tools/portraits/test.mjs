import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';

const { code } = await transformWithOxc(await fs.readFile(new URL('../../src/portraits.ts', import.meta.url), 'utf8'), 'portraits.ts');
function setup({ fetch, catalogue = {}, stored = '{}' } = {}) {
  const timers = new Map();
  let nextTimer = 1;
  let now = 1_000;
  const context = vm.createContext({
    STATE_NAME: { CA: 'California', TX: 'Texas' }, CATALOGUE: catalogue,
    localStorage: { getItem: () => stored, setItem() {} },
    fetch: fetch ?? (() => { throw Error('Unexpected network request'); }),
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  const source = code.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(source + '\nthis.findPortraits = findPortraits;', context);
  return { find: context.findPortraits, timers, advance: (ms) => { now += ms; } };
}
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
const job = (c, state = 'California') => ({ c, state, statewide: true });
const biography = (state = 'California') => ({ ok: true, status: 200, json: async () => ({ type: 'standard', title: 'Test Person', extract: `Test Person is an American politician from ${state}.`, thumbnail: { source: 'https://upload.wikimedia.org/test.jpg' } }) });

{
  const app = setup({ catalogue: { 'Test Person|CA': { uri: 'data:image/jpeg;base64,dGVzdA==', source: 'source', credit: 'U.S. Congress' } } });
  for (let n = 0; n < 2; n++) {
    const c = { name: 'Test Person', photo: 'https://bioguide.congress.gov/photo/T000001.jpg' };
    app.find([job(c)], () => {});
    assert.equal(c.photo, 'data:image/jpeg;base64,dGVzdA==');
    assert.equal(c.photoCredit, 'U.S. Congress');
  }
  const supplied = { name: 'Test Person', photo: 'https://campaign.example/photo.jpg' };
  app.find([job(supplied)], () => {});
  assert.equal(supplied.photo, 'https://campaign.example/photo.jpg');
}
{
  let finish;
  let calls = 0;
  const app = setup({ fetch: () => { calls++; return new Promise((resolve) => { finish = resolve; }); } });
  const old = { name: 'Test Person' }, refreshed = { name: 'Test Person' };
  app.find([job(old)], () => {});
  app.find([job(refreshed)], () => {});
  assert.equal(calls, 1);
  finish(biography());
  await flush();
  assert.equal(refreshed.photo, 'https://upload.wikimedia.org/test.jpg');
  assert.equal(old.photo, refreshed.photo);
  const again = { name: 'Test Person' };
  app.find([job(again)], () => {});
  assert.equal(again.photo, refreshed.photo);
  assert.equal(calls, 1);
}
{
  let calls = 0;
  const app = setup({ fetch: async () => { calls++; return { status: 404 }; } });
  app.find([job({ name: 'Test Person' })], () => {});
  await flush();
  assert.equal(calls, 4);
  app.find([job({ name: 'Test Person' })], () => {});
  await flush();
  assert.equal(calls, 4);
  app.advance(3600_001);
  app.find([job({ name: 'Test Person' })], () => {});
  await flush();
  assert.equal(calls, 8, 'negative cache expires');
}
{
  const app = setup({ stored: 'null', fetch: async () => biography('Texas') });
  const c = { name: 'Test Person' };
  app.find([job(c)], () => {});
  await flush();
  assert.equal(c.photo, undefined, 'reject politician from the wrong state');
}
{
  const app = setup({ fetch: async () => ({ ok: true, status: 200, json: async () => ({
    type: 'standard', title: '2026 California Senate election',
    extract: 'Test Person is a political candidate in California.',
    thumbnail: { source: 'https://upload.wikimedia.org/election-results.svg.png' },
  }) }) });
  const c = { name: 'Test Person' };
  app.find([job(c)], () => {});
  await flush();
  assert.equal(c.photo, undefined, 'reject election-page redirects and maps');
}
{
  let calls = 0;
  const app = setup({ fetch: async () => { calls++; throw Error('429'); } });
  app.find([job({ name: 'Test Person' })], () => {});
  await flush();
  for (let n = 0; n < 2; n++) {
    const retry = [...app.timers.values()].find((t) => t.delay === 30_000 * (n + 1));
    assert.ok(retry);
    retry.callback();
    await flush();
  }
  assert.equal(calls, 3, 'transient failures stop after three attempts');
  app.find([job({ name: 'Test Person' })], () => {});
  await flush();
  assert.equal(calls, 3);
}
console.log('Portrait regression checks passed.');
