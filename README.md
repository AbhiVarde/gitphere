# Gitphere

See where the people you follow on GitHub are based, plotted on a rotating Cobe globe.

Enter a GitHub username to map their public profile locations around the world.

[Live Demo](https://gitphere.vercel.app)

## Install

Use the globe in any Next.js project with the shadcn CLI.

```bash
npx shadcn add https://gitphere.vercel.app/r/gitphere-globe.json
```

```tsx
import { GitphereGlobe } from "@/components/gitphere-globe";

<GitphereGlobe username="yourgithubusername" size={400} theme="light" />;
```

| Prop       | Default  | Description              |
| ---------- | -------- | ------------------------ |
| `username` | Required | GitHub username          |
| `size`     | `320`    | Globe diameter in pixels |
| `theme`    | `dark`   | `dark` or `light`        |

The component is copied directly into your project and does not use Gitphere's servers.

## GitHub Badge

Add a Gitphere badge to any GitHub profile README.

```md
[![gitphere](https://gitphere.vercel.app/api/badge/YOUR_USERNAME.svg)](https://gitphere.vercel.app/?u=YOUR_USERNAME)
```

The badge shows the user's avatar, name, and the number of following accounts that were mapped.

Badge responses are cached for one day.

## Features

- Globe view with locations from followed GitHub accounts
- GIF export of the current globe
- Share to X with a pre-filled post
- Direct GIF sharing on supported mobile browsers
- Dynamic OG images for shared profiles
- Embeddable Next.js globe component
- GitHub profile README badge

## Run locally

```bash
git clone https://github.com/AbhiVarde/gitphere.git
cd gitphere

npm install
npm run dev
```

Open `http://localhost:3000` and enter a GitHub username.

### GitHub Token

GitHub allows 60 unauthenticated API requests per hour.

For a higher rate limit, create `.env.local`:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

A token with no scopes is sufficient since Gitphere only reads public profiles.

## How it works

1. Fetch the user's following list from GitHub.
2. Fetch each profile to read its public location.
3. Skip profiles without a location.
4. Geocode unique locations using Nominatim.
5. Cache geocoded locations in memory.
6. Render the coordinates on the Cobe globe.

## Stack

- Next.js 16
- TypeScript
- App Router
- shadcn/ui
- [COBE](https://github.com/shuding/cobe)
- GitHub REST API
- Nominatim
- OpenStreetMap

## Limitations

- GitHub locations are free text and are not GPS coordinates.
- Invalid or ambiguous locations may not resolve.
- The in-memory geocoding cache resets after restarts and serverless cold starts.
- Nominatim requests are throttled to respect its usage policy.
- X following data is not supported because its API requires a paid tier.

## Credits

Gitphere is built with [COBE](https://github.com/shuding/cobe), a lightweight WebGL globe library created by [Shu Ding](https://github.com/shuding).

Thanks to Shu and the contributors for building and maintaining COBE.
