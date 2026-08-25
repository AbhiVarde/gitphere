# gitphere

See your GitHub network on a map.

## stack

- next.js 15 (app router) + typescript
- shadcn/ui primitives (button, input, card) — hand-added, not pulled from the registry
- [cobe](https://cobe.vercel.app) v2 for the webgl globe
- github rest api for the following list + per-user location
- nominatim (openstreetmap) for free geocoding, with an in-memory cache

## run it

```bash
npm install
npm run dev
```

open localhost:3000, type a username (e.g. `AbhiVarde`), hit go.

## optional: raise github rate limits

unauthenticated github requests are capped at 60/hr, shared across the app. for real use, add a token:

```bash
# .env.local
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

a token with no scopes (public read) is enough, since we're only reading public profiles.

## how it works

1. `GET /api/following?username=X` hits `GET /users/{username}/following`
2. for each user in the list, fetches `GET /users/{login}` to read their `location` bio field
3. users with no location set are dropped (github doesn't have a structured location field, it's free text)
4. each unique location string is geocoded once via nominatim and cached in memory for the life of the server process
5. resolved `{ lat, lng }` pairs are passed to the globe as markers

## known limitations

- `location` is whatever the user typed into their profile, not gps — "earth", "remote", or a made-up place will fail to geocode and get silently dropped
- the in-memory geocode cache resets on every server restart / cold start on serverless — fine for this scale, would move to redis or a db table if this needed to run at real traffic
- nominatim's usage policy caps at ~1 req/sec, so the geocode step is intentionally throttled to 3 concurrent requests
- x/twitter following lookup needs a paid api tier, so this only supports github for now
