// mock protected api. not a real target - just enough to show how a signed
// endpoint behaves so the solver has something real to break.
// the page ships a seed + a signing snippet, the api rejects any request whose
// signature doesn't match or that comes without a device fingerprint.

import http from 'http';
import crypto from 'crypto';

const PORT = 8770;
const SALT = 'aX92_kf';        // baked into the page js, solver has to read it
const SEED_TTL = 8000;         // seed rotates every 8s
const BAN_MS = 4000;

let seed = newSeed();
setInterval(() => { seed = newSeed(); }, SEED_TTL);

const banned = new Map();      // ip -> until

function newSeed() {
  return crypto.randomBytes(6).toString('hex');
}

function sign(path, query, s) {
  const q = Object.keys(query).sort().map(k => `${k}=${query[k]}`).join('&');
  return crypto.createHash('md5').update(`${s}:${path}:${q}:${SALT}`).digest('hex');
}

const DATA = [
  { id: 'A1', name: 'sample-1', value: 12.4 },
  { id: 'A2', name: 'sample-2', value: 7.8 },
  { id: 'A3', name: 'sample-3', value: 33.1 },
];

function forbidden(res, json) {
  res.writeHead(403, { 'content-type': json ? 'application/json' : 'text/html' });
  res.end(json ? JSON.stringify({ error: 'invalid signature' }) : '<html><body>Forbidden - access denied</body></html>');
}

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || 'local';
  const u = new URL(req.url, `http://localhost:${PORT}`);

  const until = banned.get(ip);
  if (until && Date.now() > until) banned.delete(ip);

  // landing page, seed + signing snippet live here
  if (u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><title>panel</title></head><body>
<div id="app">loading...</div>
<script>
  window.__seed = "${seed}";
  var __salt = "${SALT}";
  function sign(path, q){
    var s = Object.keys(q).sort().map(function(k){return k+"="+q[k];}).join("&");
    return md5(window.__seed+":"+path+":"+s+":"+__salt);
  }
</script></body></html>`);
    return;
  }

  if (u.pathname === '/api/data') {
    if (banned.has(ip)) return forbidden(res, false);

    const sig = req.headers['x-sig'];
    const gotSeed = req.headers['x-seed'];
    const device = req.headers['x-device'];
    const query = Object.fromEntries(u.searchParams);

    // no fingerprint -> treat as a bot, short ban. real sites do this.
    if (!device) {
      banned.set(ip, Date.now() + BAN_MS);
      return forbidden(res, false);
    }

    if (gotSeed !== seed || sig !== sign('/api/data', query, gotSeed || '')) {
      return forbidden(res, true);
    }

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ seed: gotSeed, data: DATA }));
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (seed rotates every ${SEED_TTL / 1000}s)`);
});
