import fs from 'fs';

// round-robin pool. reads data/proxies.txt (ip:port per line) if it's there,
// otherwise everything goes direct. a proxy that gets banned sits out a cooldown
// instead of being dropped - most bans are temporary.

const COOLDOWN = 30000;

export class Pool {
  constructor(file = 'data/proxies.txt') {
    this.list = this._read(file);
    this.cooling = new Map();   // proxy -> until
    this.i = 0;
  }

  _read(file) {
    try {
      return fs.readFileSync(file, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  get live() {
    const now = Date.now();
    return this.list.filter(p => !this.cooling.has(p) || this.cooling.get(p) < now);
  }

  next() {
    const up = this.live;
    if (up.length === 0) return null;
    return up[this.i++ % up.length];
  }

  bench(proxy) {
    if (!proxy) return;
    this.cooling.set(proxy, Date.now() + COOLDOWN);
    console.log(`[proxy] ${proxy} benched for ${COOLDOWN / 1000}s`);
  }
}
