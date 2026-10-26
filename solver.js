// breaks the protected endpoint. flow:
//   1. get the landing page, pull seed + salt out of it
//   2. sign the request with the current seed
//   3. attach a device fingerprint, send it
//   4. on 403 the seed probably rotated - refetch the page, rotate proxy,
//      back off and retry
//
// think of it as a worker that keeps running: the seed rotates every 8s so the
// signature has to be rebuilt each round, not cached.

import http from 'http';
import { sign, fromPage } from './lib/sign.js';
import { makeDevice } from './lib/fingerprint.js';
import { Pool } from './lib/proxies.js';

const BASE = 'http://localhost:8770';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_TRIES = 6;

const proxies = new Pool();

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(new URL(BASE + path), { headers: { 'user-agent': UA, ...headers }, timeout: 8000 }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function openSession() {
  const r = await get('/');
  if (r.status !== 200) throw new Error('landing page ' + r.status);
  return fromPage(r.body);
}

function isBan(r) {
  return r.status === 403 || (typeof r.body === 'string' && r.body.toLowerCase().includes('forbidden'));
}

async function fetchData(query) {
  let session = await openSession();

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const proxy = proxies.next();   // demo only logs it; in real use this feeds the agent
    const device = makeDevice(UA);
    const sig = sign('/api/data', query, session.seed, session.salt);
    const qs = new URLSearchParams(query).toString();

    const r = await get(`/api/data?${qs}`, { 'x-seed': session.seed, 'x-sig': sig, 'x-device': device.profile });

    if (r.status === 200) {
      const out = JSON.parse(r.body);
      console.log(`[solver] ok  sig=${sig.slice(0, 8)}  device=${device.id.slice(0, 8)}  rows=${out.data.length}`);
      return out.data;
    }

    if (isBan(r)) {
      console.log(`[solver] ${r.status} - stale seed or banned, refreshing (try ${attempt + 1})`);
      proxies.bench(proxy);
      session = await openSession();
      await sleep(300 * 2 ** attempt);
      continue;
    }

    console.log(`[solver] unexpected ${r.status}: ${r.body.slice(0, 80)}`);
    await sleep(300 * 2 ** attempt);
  }
  throw new Error('gave up, out of tries');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

fetchData({ league: 'x', day: '0' })
  .then(rows => {
    console.log('\ndata:');
    for (const r of rows) console.log(' ', r.id, r.name, r.value);
  })
  .catch(e => { console.error('[solver] error:', e.message); process.exit(1); });
