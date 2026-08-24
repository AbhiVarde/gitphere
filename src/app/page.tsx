"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe as GlobeIcon, Share2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Globe, type AvatarPoint } from "@/components/globe";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { captureGlobeGif } from "@/lib/capture-gif";

type Marker = {
  login: string;
  name: string | null;
  avatar_url: string;
  location: string;
  lat: number;
  lng: number;
};

type Origin = Marker | null;

type ApiResponse = {
  origin: Origin;
  markers: Marker[];
  total: number;
  resolved: number;
  error?: string;
};

export default function Home() {
  const [username, setUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("u") ?? "";
  });
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  async function runSearch(name: string) {
    const trimmed = name.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(
        `/api/following?username=${encodeURIComponent(trimmed)}`,
      );
      const json: ApiResponse = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "something went wrong");
      }
      setData(json);
      setLastQuery(trimmed);
      const params = new URLSearchParams(window.location.search);
      params.set("u", trimmed);
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("u");
    if (fromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: kicks off a fetch on mount
      runSearch(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(username);
  }

  const globePoints: AvatarPoint[] = useMemo(() => {
    if (!data) return [];
    const points: AvatarPoint[] = data.markers.map((m) => ({
      id: m.login,
      lat: m.lat,
      lng: m.lng,
      avatar_url: m.avatar_url,
      label: `${m.name || m.login} · ${m.location}`,
    }));
    if (data.origin) {
      points.push({
        id: data.origin.login,
        lat: data.origin.lat,
        lng: data.origin.lng,
        avatar_url: data.origin.avatar_url,
        label: `${data.origin.name || data.origin.login} (you) · ${data.origin.location}`,
        isOrigin: true,
      });
    }
    return points;
  }, [data]);

  async function handleShare() {
    if (!data || globePoints.length === 0 || sharing) return;

    const gifWindow = window.open("", "_blank");
    const tweetWindow = window.open("", "_blank");

    setSharing(true);
    setError(null);
    try {
      const blob = await captureGlobeGif(globePoints);
      const gifUrl = URL.createObjectURL(blob);

      if (gifWindow) gifWindow.location.href = gifUrl;

      const shareLink = window.location.href;
      const text = `mapped where ${lastQuery}'s github following are based, on a globe\n\n${shareLink}`;
      const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      if (tweetWindow) tweetWindow.location.href = tweetUrl;

      setTimeout(() => URL.revokeObjectURL(gifUrl), 30000);
    } catch (err) {
      gifWindow?.close();
      tweetWindow?.close();
      setError(err instanceof Error ? err.message : "couldn't create the gif");
    } finally {
      setSharing(false);
    }
  }

  const canShare = !!data && globePoints.length > 0;

  return (
    <main className="flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-999 flex shrink-0 flex-col gap-2 border-b border-neutral-900 bg-black/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex items-center justify-between gap-2 sm:contents">
          <h1 className="text-sm font-medium tracking-tight text-white">
            gh globe
          </h1>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            disabled={!canShare || sharing}
            aria-label="share on x"
            className="order-3 h-8 w-8 shrink-0 p-0 sm:order-0 sm:w-auto sm:gap-1.5 sm:px-3"
          >
            {sharing ? (
              <Spinner className="size-3.5" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden text-xs sm:inline">
              {sharing ? "capturing…" : "share"}
            </span>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full gap-2 sm:max-w-xs">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="github username..."
            className="h-8 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="h-8 shrink-0 px-3"
          >
            {loading ? <Spinner className="size-3.5" /> : "go"}
          </Button>
        </form>
      </header>

      {error && (
        <p className="shrink-0 px-6 py-2 text-center text-sm text-neutral-400">
          {error}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_340px] md:overflow-hidden">
        <div className="flex items-center justify-center p-4 sm:p-6">
          <Globe points={globePoints} />
        </div>

        <aside className="flex flex-col border-t border-neutral-900 md:min-h-0 md:border-l md:border-t-0">
          {data?.origin && (
            <div className="flex shrink-0 items-center gap-3 border-b border-neutral-900 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.origin.avatar_url}
                alt={data.origin.login}
                className="h-9 w-9 shrink-0 rounded-full ring-2 ring-white"
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-200">
                  {data.origin.name || data.origin.login}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {data.origin.location}
                </p>
              </div>
            </div>
          )}

          {data && !data.origin && (
            <p className="shrink-0 border-b border-neutral-900 px-4 py-3 text-xs text-neutral-500">
              no location set on {lastQuery}&apos;s profile, so no origin point
              or lines
            </p>
          )}

          {data && (
            <p className="shrink-0 px-4 py-2 text-xs text-neutral-500">
              {data.resolved} of {data.total} following resolved to a location
            </p>
          )}

          <div className="px-2 pb-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
            {data?.markers.map((m) => (
              <a
                key={m.login}
                href={`https://github.com/${m.login}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-neutral-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.avatar_url}
                  alt={m.login}
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-7 shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-200">
                    {m.name || m.login}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {m.location}
                  </p>
                </div>
              </a>
            ))}

            {loading && (
              <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
                <Spinner className="size-4 text-neutral-600" />
                <p className="text-xs text-neutral-600">mapping following…</p>
              </div>
            )}

            {!data && !loading && (
              <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
                <GlobeIcon className="size-5 text-neutral-700" />
                <p className="text-xs text-neutral-600">
                  search a github username to map who they follow
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
