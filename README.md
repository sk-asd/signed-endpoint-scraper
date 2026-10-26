# signed-endpoint-scraper

Small demo of getting data out of an endpoint that's protected by a request
signature and a device fingerprint. There's no real target here - both the
protection and the solver are in this repo.

Most serious sites don't hand you the data. A snippet on the page signs each
request, and the API drops anything that isn't signed correctly or shows up
without a device fingerprint. This sets that whole thing up on one machine:

- `server.js` - the protected mock API. It embeds a `seed` in the page and
  expects `/api/data` to be signed as `md5(seed + path + params + salt)`. Wrong
  signature or missing fingerprint gets a 403. The seed rotates every 8s.
- `solver.js` - pulls the page, reads the seed and salt out of it, rebuilds the
  signature itself, attaches a device fingerprint and pulls the data. On a 403
  the seed has usually rotated, so it refetches the page and retries with backoff.

Nothing is handed to the solver - it reads the signing scheme off the page and
reproduces it. Same idea as the signature headers real sites put on their
internal API calls.

## Run

Two terminals:

```
node server.js      # http://localhost:8770
node solver.js
```

Expected:

```
[solver] ok  sig=83e5f57a  device=1a1d893a  rows=3

data:
  A1 sample-1 12.4
  A2 sample-2 7.8
  A3 sample-3 33.1
```

Hit it raw to see the protection kick in:

```
curl "http://localhost:8770/api/data?league=x&day=0"   # -> 403
```

## Layout

- `lib/sign.js` - reads seed/salt off the page and builds the signature. Kept
  separate because that's the one spot that breaks when a site renames things.
- `lib/fingerprint.js` - builds the device profile (screen, platform, canvas)
  and base64s it. Generating a new one every request gets you flagged, so it's
  stable per run.
- `lib/proxies.js` - round-robin pool, benches a banned proxy for a cooldown.
  Reads `data/proxies.txt` if present, otherwise goes direct.

## Notes

- No dependencies, just Node stdlib (`http`, `crypto`). `node >= 18`.
- I use the same approach on signed odds APIs and endpoints behind login panels;
  the target-specific parts obviously aren't in here.
- Respecting a site's terms and rate limits, and only pulling data you're
  allowed to, is on you.
