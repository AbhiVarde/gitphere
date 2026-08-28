import { NextRequest, NextResponse } from "next/server";
import {
  fetchFollowing,
  fetchGithubUser,
  fetchGithubUserOrThrow,
} from "@/lib/github";

// Sent to GitHub's API as the User-Agent header, required by their API.
// Change this to your own project name if you like — it has no effect on behavior.
const USER_AGENT = "gitphere-globe-widget";

type Marker = {
  login: string;
  name: string | null;
  avatar_url: string;
  location: string;
  lat: number;
  lng: number;
};

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocode(
  location: string,
): Promise<{ lat: number; lng: number } | null> {
  const key = location.trim().toLowerCase();
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key) ?? null;
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        location,
      )}`,
      // Nominatim's usage policy requires an identifying User-Agent — swap in your own
      // project name and, ideally, a contact (see https://operations.osmfoundation.org/policies/nominatim/).
      { headers: { "User-Agent": `${USER_AGENT} (personal project)` } },
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
    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
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
  fn: (item: T) => Promise<R>,
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
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 },
    );
  }

  try {
    const [originUser, following] = await Promise.all([
      fetchGithubUserOrThrow(username, USER_AGENT),
      fetchFollowing(username, USER_AGENT),
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

    const users = await mapWithConcurrency(following, 5, async (f) => {
      const user = await fetchGithubUser(f.login, USER_AGENT);
      return (
        user ?? {
          login: f.login,
          avatar_url: f.avatar_url,
          location: null,
          name: null,
          following: 0,
        }
      );
    });

    const withLocation = users.filter(
      (u): u is (typeof users)[number] & { location: string } =>
        !!u.location && u.location.trim().length > 0,
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
