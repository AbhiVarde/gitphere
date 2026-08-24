import { NextRequest, NextResponse } from "next/server";

type GithubUser = {
  login: string;
  avatar_url: string;
  location: string | null;
  name: string | null;
};

type Marker = {
  login: string;
  name: string | null;
  avatar_url: string;
  location: string;
  lat: number;
  lng: number;
};

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "gh-globe-app",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchFollowing(username: string): Promise<{ login: string; avatar_url: string }[]> {
  const res = await fetch(
    `https://api.github.com/users/${username}/following?per_page=100`,
    { headers: githubHeaders(), cache: "no-store" }
  );
  if (res.status === 404) {
    throw new Error("github user not found");
  }
  if (!res.ok) {
    throw new Error(`github following lookup failed (${res.status})`);
  }
  return res.json();
}

async function fetchUser(username: string): Promise<GithubUser> {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    return { login: username, avatar_url: "", location: null, name: null };
  }
  return res.json();
}

async function fetchOriginUser(username: string): Promise<GithubUser> {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error("github user not found");
  }
  if (!res.ok) {
    throw new Error(`github user lookup failed (${res.status})`);
  }
  return res.json();
}

async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  const key = location.trim().toLowerCase();
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key) ?? null;
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        location
      )}`,
      { headers: { "User-Agent": "gh-globe-app (personal project)" } }
    );
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      geocodeCache.set(key, null);
      return null;
    }
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geocodeCache.set(key, result);
    return result;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const [originUser, following] = await Promise.all([
      fetchOriginUser(username),
      fetchFollowing(username),
    ]);

    let origin: Marker | null = null;
    if (originUser.location) {
      const coords = await geocode(originUser.location);
      if (coords) {
        origin = {
          login: originUser.login,
          name: originUser.name,
          avatar_url: originUser.avatar_url,
          location: originUser.location,
          lat: coords.lat,
          lng: coords.lng,
        };
      }
    }

    if (following.length === 0) {
      return NextResponse.json({ origin, markers: [], total: 0, resolved: 0 });
    }

    const users = await mapWithConcurrency(following, 5, (f) => fetchUser(f.login));

    const withLocation = users.filter(
      (u): u is GithubUser & { location: string } => !!u.location && u.location.trim().length > 0
    );

    const markers = await mapWithConcurrency(withLocation, 3, async (u) => {
      const coords = await geocode(u.location);
      if (!coords) return null;
      const marker: Marker = {
        login: u.login,
        name: u.name,
        avatar_url: u.avatar_url,
        location: u.location,
        lat: coords.lat,
        lng: coords.lng,
      };
      return marker;
    });

    const resolved = markers.filter((m): m is Marker => m !== null);

    return NextResponse.json({
      origin,
      markers: resolved,
      total: following.length,
      resolved: resolved.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
