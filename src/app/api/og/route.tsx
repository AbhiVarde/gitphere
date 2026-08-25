import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

async function getGlobeDataUri() {
  const filePath = path.join(process.cwd(), "public", "og-globe.png");
  const buffer = await readFile(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function getGithubUser(username: string) {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "gitphere-og",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers,
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      avatar_url: string;
      name: string | null;
      following: number;
    }>;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("u")?.trim();

  const [globeDataUri, user] = await Promise.all([
    getGlobeDataUri(),
    username ? getGithubUser(username) : Promise.resolve(null),
  ]);

  const avatarUrl =
    user?.avatar_url ??
    (username ? `https://github.com/${username}.png` : null);
  const displayName = user?.name || username || "gitphere";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000000",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={globeDataUri}
        alt=""
        width={520}
        height={520}
        style={{
          position: "absolute",
          top: 55,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: 0.9,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#a3a3a3",
            letterSpacing: 2,
            marginBottom: 14,
          }}
        >
          GITHUB NETWORK
        </div>

        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={104}
            height={104}
            style={{
              borderRadius: "50%",
              border: "4px solid white",
              marginBottom: 20,
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            fontSize: 46,
            color: "#ffffff",
            fontWeight: 700,
          }}
        >
          {displayName}
        </div>

        {user && (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#a3a3a3",
              marginTop: 10,
            }}
          >
            {user.following} connections mapped
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 28,
          fontSize: 20,
          color: "#525252",
        }}
      >
        gitphere
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
