export type GithubUser = {
  login: string;
  avatar_url: string;
  location: string | null;
  name: string | null;
  following: number;
};

function githubHeaders(userAgent: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": userAgent,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/** Fetches a GitHub user, returning null on any failure (404, rate limit, network error). */
export async function fetchGithubUser(
  username: string,
  userAgent: string,
): Promise<GithubUser | null> {
  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: githubHeaders(userAgent),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Fetches a GitHub user, throwing a descriptive error on failure (used where a missing user is fatal). */
export async function fetchGithubUserOrThrow(
  username: string,
  userAgent: string,
): Promise<GithubUser> {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: githubHeaders(userAgent),
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

export async function fetchFollowing(
  username: string,
  userAgent: string,
): Promise<{ login: string; avatar_url: string }[]> {
  const res = await fetch(
    `https://api.github.com/users/${username}/following?per_page=100`,
    { headers: githubHeaders(userAgent), cache: "no-store" },
  );
  if (res.status === 404) {
    throw new Error("github user not found");
  }
  if (!res.ok) {
    throw new Error(`github following lookup failed (${res.status})`);
  }
  return res.json();
}
