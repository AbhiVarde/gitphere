import createGlobe, { type COBEOptions } from "cobe";
import { GLOBE_RADIUS_RATIO, THETA, project } from "./globe-projection";
import type { AvatarPoint } from "@/components/globe";

const SIZE = 360; // gif output is square, kept small for fast render + small file size
const FRAME_COUNT = 48; // 7.5° steps = one full rotation
const FRAME_DELAY = 90; // ms per frame in the encoded gif, full loop is about 4.3s

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function buildArcs(points: AvatarPoint[]) {
  const origin = points.find((p) => p.isOrigin);
  if (!origin) return [];
  return points
    .filter((p) => !p.isOrigin)
    .map((p) => ({
      from: [origin.lat, origin.lng] as [number, number],
      to: [p.lat, p.lng] as [number, number],
      color: [0.85, 0.85, 0.85] as [number, number, number],
    }));
}

function buildMarkers(points: AvatarPoint[]) {
  return points.map((p) => ({
    location: [p.lat, p.lng] as [number, number],
    size: p.isOrigin ? 0.045 : 0.02,
  }));
}

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

export async function captureGlobeGif(points: AvatarPoint[]): Promise<Blob> {
  if (points.length === 0) {
    throw new Error("nothing to capture yet");
  }

  const { default: GIF } = await import("gif.js");

  const avatarImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    points.map(async (p) => {
      try {
        avatarImages.set(p.id, await loadImage(p.avatar_url));
      } catch {}
    }),
  );

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = SIZE * 2;
  sourceCanvas.height = SIZE * 2;

  const arcs = buildArcs(points);
  const markers = buildMarkers(points);

  const globeOptions: COBEOptions = {
    devicePixelRatio: 2,
    width: SIZE * 2,
    height: SIZE * 2,
    phi: 0,
    theta: THETA,
    dark: 1,
    diffuse: 1.1,
    mapSamples: 12000,
    mapBrightness: 5,
    baseColor: [0.16, 0.16, 0.17],
    markerColor: [0.9, 0.9, 0.9],
    glowColor: [0.35, 0.35, 0.38],
    arcColor: [0.8, 0.8, 0.8],
    arcWidth: 0.55,
    arcHeight: 0.3,
    markers,
    arcs,
    context: { preserveDrawingBuffer: true },
  };

  const globe = createGlobe(sourceCanvas, globeOptions);

  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = SIZE;
  compositeCanvas.height = SIZE;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) {
    globe.destroy();
    throw new Error("canvas 2d context not supported");
  }

  const gif = new GIF({
    workers: 2,
    quality: 8,
    width: SIZE,
    height: SIZE,
    workerScript: "/gif.worker.js",
    background: "#000000",
    transparent: null,
  });

  const radius = SIZE * GLOBE_RADIUS_RATIO;
  const center = SIZE / 2;

  for (let i = 0; i < FRAME_COUNT; i++) {
    const phi = (i / FRAME_COUNT) * Math.PI * 2;
    globe.update({ phi, width: SIZE * 2, height: SIZE * 2, markers, arcs });
    await waitForPaint();

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(sourceCanvas, 0, 0, SIZE, SIZE);

    const sorted = [...points].sort(
      (a, b) =>
        project(a.lat, a.lng, phi, THETA, radius).z -
        project(b.lat, b.lng, phi, THETA, radius).z,
    );

    for (const p of sorted) {
      const img = avatarImages.get(p.id);
      if (!img) continue;
      const { x, y, z } = project(p.lat, p.lng, phi, THETA, radius);
      if (z <= -0.15) continue;

      const depth = Math.max(0, Math.min(1, (z + 0.15) / 1.15));
      const baseSize = p.isOrigin ? 34 : 22;
      const d = baseSize * (0.55 + depth * 0.55);
      const cx = center + x;
      const cy = center + y;

      ctx.save();
      ctx.globalAlpha = 0.35 + depth * 0.65;
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, cx - d / 2, cy - d / 2, d, d);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.lineWidth = p.isOrigin ? 2 : 1;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
    }

    gif.addFrame(ctx, { copy: true, delay: FRAME_DELAY });
  }

  globe.destroy();

  return new Promise<Blob>((resolve, reject) => {
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("gif capture aborted")));
    gif.render();
  });
}
