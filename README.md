# Gitphere

Paste a GitHub username and see where the people they follow are based, plotted on a Cobe globe.

## Stack

- Next.js 16 with App Router and TypeScript
- shadcn/ui primitives for Button, Input, and Card, added manually
- [Cobe](https://cobe.vercel.app) v2 for the WebGL globe
- GitHub REST API for the following list and user locations
- Nominatim with OpenStreetMap for free geocoding, with an in-memory cache

## Run it

```bash
npm install
npm run dev
```

Open `localhost:3000`, enter a GitHub username such as `AbhiVarde`, and hit **Go**.

## Optional: Increase GitHub Rate Limits

Unauthenticated GitHub requests are limited to 60 requests per hour, shared across the app. For higher limits, add a GitHub token:

```bash
# .env.local

GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

A token with no scopes is enough because the app only reads public profiles.

## How It Works

1. `GET /api/following?username=X` calls GitHub's `GET /users/{username}/following` endpoint.
2. For each user, the app fetches `GET /users/{login}` to read their profile location.
3. Users without a location are skipped because GitHub stores locations as free text.
4. Each unique location is geocoded once through Nominatim and cached in memory.
5. Resolved latitude and longitude coordinates are passed to the globe as markers.

## use it on your own site

Add the globe to any Next.js project with the shadcn CLI:

```bash
npx shadcn add https://gitphere.vercel.app/r/gitphere-globe.json
```

This copies the component source into your project. It doesn't call gitphere's servers. Add your own optional `GITHUB_TOKEN` (see above), then drop it in:

```tsx
import { GitphereGlobe } from "@/components/gitphere-globe";

<GitphereGlobe username="yourgithubusername" size={400} theme="light" />;
```

- `size`: diameter in pixels. Defaults to `320`.
- `theme`: `"dark"` or `"light"`. Defaults to `"dark"`.

## embed your badge

drop this in your GitHub profile README, or any markdown:

```md
[![gitphere](https://gitphere.vercel.app/api/badge/YOUR_USERNAME.svg)](https://gitphere.vercel.app/?u=YOUR_USERNAME)
```

renders a small card, your avatar, name, and how many of your following got mapped, generated fresh from the GitHub API, cached for a day so repeat views don't hit rate limits.

## known limitations

- A GitHub location is whatever the user entered in their profile, not GPS coordinates. Locations such as `earth`, `remote`, or made-up places may fail to geocode and will be skipped.
- The in-memory geocode cache resets after every server restart or serverless cold start. For larger traffic, this could be moved to Redis or a database.
- Nominatim's usage policy limits requests to around one per second, so geocoding is intentionally throttled.
- X/Twitter following data requires a paid API tier, so GitHub is the only supported platform for now.
