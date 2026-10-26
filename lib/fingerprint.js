import crypto from 'crypto';

// device fingerprint. real sites read canvas/webgl/screen from the browser and
// base64 it; the server checks it exists and stays consistent. we build the
// same shape so the request looks like a real tab.

const screens = ['1920x1080', '1366x768', '1600x900', '2560x1440'];
const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];

export function makeDevice(ua) {
  const p = {
    v: 1,
    ua,
    lang: 'en-US',
    colorDepth: 24,
    screen: pick(screens),
    platform: pick(platforms),
    tz: pick([-180, -120, 0, 60, 180]),
    ts: Date.now(),
    // fake but stable per run. regenerating every request gets you flagged.
    canvas: 'data:image/png;base64,' + crypto.randomBytes(48).toString('base64'),
  };
  const profile = Buffer.from(JSON.stringify(p)).toString('base64');
  const id = crypto.createHash('md5').update(profile).digest('hex');
  return { profile, id };
}

const pick = a => a[Math.floor(Math.random() * a.length)];
