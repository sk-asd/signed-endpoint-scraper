import crypto from 'crypto';

// same algo the page js uses. has to match the server byte for byte or it's a 403.
export function sign(path, query, seed, salt) {
  const q = Object.keys(query).sort().map(k => `${k}=${query[k]}`).join('&');
  return crypto.createHash('md5').update(`${seed}:${path}:${q}:${salt}`).digest('hex');
}

// pull seed + salt out of the landing page. if the site renames these this is
// the only place that breaks, so it's kept on its own.
export function fromPage(html) {
  const seed = (html.match(/window\.__seed\s*=\s*"([^"]+)"/) || [])[1];
  const salt = (html.match(/__salt\s*=\s*"([^"]+)"/) || [])[1];
  if (!seed || !salt) throw new Error('no seed/salt in page - signing js probably changed');
  return { seed, salt };
}
