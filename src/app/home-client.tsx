"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Globe as GlobeIcon } from "lucide-react";
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

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function HomeClient() {
  const [username, setUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("u") ?? "";
  });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareStage, setShareStage] = useState<"idle" | "capturing" | "ready">(
    "idle",
  );
  const [pendingShare, setPendingShare] = useState<{
    file: File;
    text: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [copied, setCopied] = useState(false);

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

  function tweetIntentUrl(text: string) {
    return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  }

  function isMobileDevice() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  async function handleShareClick() {
    if (!data || globePoints.length === 0) return;

    if (shareStage === "ready" && pendingShare) {
      try {
        await navigator.share({
          files: [pendingShare.file],
          text: pendingShare.text,
          title: "gitphere",
        });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(
            err instanceof Error ? err.message : "couldn't share the gif",
          );
        }
      } finally {
        setShareStage("idle");
        setPendingShare(null);
      }
      return;
    }

    if (shareStage !== "idle") return;

    const shareLink = window.location.href;
    const text = `here's my github network, mapped on a globe\n\n${shareLink}`;
    const canFileShare =
      isMobileDevice() &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function";

    if (!canFileShare) {
      window.open(tweetIntentUrl(text), "_blank", "noreferrer");
      return;
    }

    setShareStage("capturing");
    setError(null);
    try {
      const blob = await captureGlobeGif(globePoints);
      const file = new File([blob], `${lastQuery || "gitphere"}.gif`, {
        type: "image/gif",
      });

      if (navigator.canShare({ files: [file] })) {
        setPendingShare({ file, text });
        setShareStage("ready");
      } else {
        window.open(tweetIntentUrl(text), "_blank", "noreferrer");
        setShareStage("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't create the gif");
      setShareStage("idle");
    }
  }

  const canShare = !!data && globePoints.length > 0;
  const installCommand =
    "npx shadcn add https://gitphere.vercel.app/r/gitphere-globe.json";

  async function handleCopyInstall() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable, nothing to fall back to here
    }
  }

  async function handleDownload() {
    if (!canShare || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await captureGlobeGif(globePoints);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${lastQuery || "gitphere"}.gif`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't create the gif");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-999 flex shrink-0 flex-col gap-2 border-b border-neutral-900 bg-black/95 px-4 py-3 backdrop-blur sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4 sm:px-5">
        <div className="flex items-center justify-between gap-2 sm:contents">
          <h1 className="text-sm font-medium tracking-tight text-white">
            gitphere
          </h1>
          <a
            href="https://github.com/AbhiVarde/gitphere"
            target="_blank"
            rel="noreferrer"
            className="order-3"
          >
            <Button
              variant="outline"
              size="sm"
              aria-label="view on github"
              className="h-8 w-8 shrink-0 p-0"
            >
              <GithubLogo className="size-3.5" />
            </Button>
          </a>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full gap-2 sm:order-2 sm:mx-auto sm:max-w-xs"
        >
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
        <div className="relative flex items-center justify-center p-4 sm:p-6">
          <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 sm:right-6 sm:top-6 md:flex">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!canShare || downloading}
              aria-label="download gif"
              className="h-8 w-8 shrink-0 border-neutral-800 bg-black/70 p-0 backdrop-blur"
            >
              {downloading ? (
                <Spinner className="size-3.5" />
              ) : (
                <Download className="size-3.5" />
              )}
            </Button>

            <Button
              variant={shareStage === "ready" ? "default" : "outline"}
              size="sm"
              onClick={handleShareClick}
              disabled={!canShare || shareStage === "capturing"}
              className={
                shareStage === "ready"
                  ? "h-8 shrink-0 gap-1.5 px-3"
                  : "h-8 shrink-0 gap-1.5 border-neutral-800 bg-black/70 px-3 backdrop-blur"
              }
            >
              {shareStage === "capturing" ? (
                <Spinner className="size-3.5" />
              ) : (
                <XLogo className="size-3.5" />
              )}
              <span className="text-xs">
                {shareStage === "capturing" ? "preparing…" : "share on X"}
              </span>
            </Button>
          </div>

          <div className="mx-auto w-full max-w-[320px] sm:max-w-115 md:max-w-140 lg:max-w-155">
            <Globe points={globePoints} size={620} />
          </div>
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

          <div className="hidden shrink-0 border-t border-neutral-900 px-4 py-3 md:block">
            <p className="text-xs text-neutral-500">
              want this on your own site? same globe, with download and share on
              X built in.
            </p>
            <div className="relative mt-2 rounded-md border border-neutral-800 bg-neutral-950 py-2 pl-3 pr-9">
              <code className="block overflow-x-auto whitespace-nowrap text-[11px] leading-relaxed text-neutral-300 scrollbar-none [&::-webkit-scrollbar]:hidden">
                {installCommand}
              </code>
              <button
                type="button"
                onClick={handleCopyInstall}
                aria-label="copy install command"
                className="absolute right-2 top-2 shrink-0 bg-neutral-950 pl-2 text-neutral-500 transition-colors hover:text-neutral-300"
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            <a
              href="https://github.com/AbhiVarde/gitphere#use-it-on-your-own-site"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-block text-[11px] text-neutral-600 underline underline-offset-2 hover:text-neutral-400"
            >
              read the docs
            </a>
          </div>
        </aside>
      </div>

      <footer className="sticky bottom-0 z-999 flex shrink-0 items-center gap-2 border-t border-neutral-900 bg-black/95 px-4 py-2.5 backdrop-blur md:hidden">
        <code className="min-w-0 flex-1 truncate rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[11px] text-neutral-300">
          {installCommand}
        </code>

        <button
          type="button"
          onClick={handleCopyInstall}
          aria-label="copy install command"
          className="shrink-0 text-neutral-500 transition-colors hover:text-neutral-300"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!canShare || downloading}
          aria-label="download gif"
          className="h-8 w-8 shrink-0 p-0"
        >
          {downloading ? (
            <Spinner className="size-3.5" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>

        <Button
          variant={shareStage === "ready" ? "default" : "outline"}
          size="sm"
          onClick={handleShareClick}
          disabled={!canShare || shareStage === "capturing"}
          aria-label="share on x"
          className="h-8 w-8 shrink-0 p-0"
        >
          {shareStage === "capturing" ? (
            <Spinner className="size-3.5" />
          ) : (
            <XLogo className="size-3.5" />
          )}
        </Button>
      </footer>
    </main>
  );
}
