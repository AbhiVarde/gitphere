const CARD_WIDTH = 420;
const CARD_HEIGHT = 110;

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function getGithubUser(username: string) {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "gitphere-badge",
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

async function getAvatarDataUri(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

function buildCard(
  username: string,
  avatarDataUri: string | null,
  name: string,
  following: number,
) {
  const avatar = avatarDataUri
    ? `<image href="${avatarDataUri}" x="21" y="21" width="68" height="68" clip-path="url(#avatarClip)" />`
    : `<circle cx="55" cy="55" r="34" fill="#171717" />`;

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="avatarClip"><circle cx="55" cy="55" r="34" /></clipPath>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="12" fill="#000000" stroke="#262626" stroke-width="1" />
  ${avatar}
  <circle cx="55" cy="55" r="34" fill="none" stroke="#ffffff" stroke-width="2" />
  <text x="105" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
  <text x="105" y="62" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#a3a3a3">${following} connections mapped on gitphere</text>
  <text x="105" y="84" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#525252">gitphere.vercel.app/?u=${escapeXml(username)}</text>
</svg>`;
}

function buildFallbackCard(username: string) {
  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="12" fill="#000000" stroke="#262626" stroke-width="1" />
  <text x="21" y="55" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#a3a3a3">couldn't find "${escapeXml(username)}" on GitHub</text>
  <text x="21" y="78" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#525252">gitphere.vercel.app</text>
</svg>`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  const username = raw.replace(/\.svg$/i, "");

  const user = await getGithubUser(username);

  const svg = user
    ? buildCard(
        username,
        await getAvatarDataUri(user.avatar_url),
        user.name || username,
        user.following,
      )
    : buildFallbackCard(username);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
