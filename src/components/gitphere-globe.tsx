"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, type AvatarPoint, type GlobeTheme } from "@/components/globe";

type Marker = {
  login: string;
  name: string | null;
  avatar_url: string;
  location: string;
  lat: number;
  lng: number;
};

type ApiResponse = {
  origin: Marker | null;
  markers: Marker[];
  total: number;
  resolved: number;
  error?: string;
};

export type GitphereGlobeProps = {
  /** GitHub username whose following list gets mapped. */
  username: string;
  /** Diameter of the globe in pixels. Defaults to 320. */
  size?: number;
  /** Color palette for the globe. Defaults to "dark". */
  theme?: GlobeTheme;
  /**
   * Path to the installed API route that resolves following + locations.
   * Defaults to "/api/gitphere-following", the route this registry item installs alongside it.
   * Override only if you renamed the route or proxy it elsewhere.
   */
  endpoint?: string;
  className?: string;
};

export function GitphereGlobe({
  username,
  size = 320,
  theme = "dark",
  endpoint = "/api/gitphere-following",
  className,
}: GitphereGlobeProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets loading/error state when username or endpoint changes, before kicking off the new fetch
    setLoading(true);
    setError(null);

    fetch(`${endpoint}?username=${encodeURIComponent(username)}`)
      .then(async (res) => {
        const json: ApiResponse = await res.json();
        if (!res.ok) throw new Error(json.error || "something went wrong");
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "something went wrong");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, endpoint]);

  const points: AvatarPoint[] = useMemo(() => {
    if (!data) return [];
    const mapped: AvatarPoint[] = data.markers.map((m) => ({
      id: m.login,
      lat: m.lat,
      lng: m.lng,
      avatar_url: m.avatar_url,
      label: `${m.name || m.login} · ${m.location}`,
    }));
    if (data.origin) {
      mapped.push({
        id: data.origin.login,
        lat: data.origin.lat,
        lng: data.origin.lng,
        avatar_url: data.origin.avatar_url,
        label: `${data.origin.name || data.origin.login} · ${data.origin.location}`,
        isOrigin: true,
      });
    }
    return mapped;
  }, [data]);

  if (error) {
    return (
      <div className={className} style={{ maxWidth: size }} role="alert">
        <p className="text-sm text-neutral-500">
          couldn&apos;t load @{username}&apos;s globe: {error}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          maxWidth: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-busy="true"
        aria-label={`loading @${username}'s following map`}
      >
        <p className="text-sm text-white/40 animate-pulse">
          mapping @{username}&apos;s network…
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Globe points={points} size={size} theme={theme} />
    </div>
  );
}
