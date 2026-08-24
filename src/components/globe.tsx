"use client";

import { useEffect, useRef } from "react";
import createGlobe, { type Marker as CobeArcPoint } from "cobe";
import {
  AUTO_ROTATE_SPEED,
  GLOBE_RADIUS_RATIO,
  THETA,
  project,
} from "@/lib/globe-projection";

export type AvatarPoint = {
  id: string;
  lat: number;
  lng: number;
  avatar_url: string;
  label: string;
  isOrigin?: boolean;
};

export function Globe({ points }: { points: AvatarPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phi = useRef(0);
  const width = useRef(0);
  const pointsRef = useRef(points);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let frame: number;
    const isSmallScreen = window.innerWidth < 640;

    let resizeFrame: number | null = null;
    const onResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        width.current = container.offsetWidth;
        resizeFrame = null;
      });
    };
    window.addEventListener("resize", onResize);
    onResize();

    const buildArcs = () => {
      const origin = pointsRef.current.find((p) => p.isOrigin);
      if (!origin) return [];
      return pointsRef.current
        .filter((p) => !p.isOrigin)
        .map((p) => ({
          from: [origin.lat, origin.lng] as [number, number],
          to: [p.lat, p.lng] as [number, number],
          color: [0.85, 0.85, 0.85] as [number, number, number],
        }));
    };

    const buildMarkers = (): CobeArcPoint[] =>
      pointsRef.current.map((p) => ({
        location: [p.lat, p.lng],
        size: p.isOrigin ? 0.045 : 0.02,
      }));

    const dpr = isSmallScreen ? 1.5 : 2;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width.current * dpr,
      height: width.current * dpr,
      phi: 0,
      theta: THETA,
      dark: 1,
      diffuse: 1.1,
      mapSamples: isSmallScreen ? 9000 : 17000,
      mapBrightness: 5,
      baseColor: [0.16, 0.16, 0.17],
      markerColor: [0.9, 0.9, 0.9],
      glowColor: [0.35, 0.35, 0.38],
      arcColor: [0.8, 0.8, 0.8],
      arcWidth: 0.55,
      arcHeight: 0.3,
      markers: buildMarkers(),
      arcs: buildArcs(),
    });

    const animate = () => {
      if (document.hidden) {
        frame = requestAnimationFrame(animate);
        return;
      }

      if (pointerInteracting.current === null) {
        phi.current += AUTO_ROTATE_SPEED;
      }
      globe.update({
        phi: phi.current,
        width: width.current * dpr,
        height: width.current * dpr,
        markers: buildMarkers(),
        arcs: buildArcs(),
      });

      const radius = width.current * GLOBE_RADIUS_RATIO;
      const centerX = width.current / 2;
      const centerY = width.current / 2;

      for (const p of pointsRef.current) {
        const el = avatarRefs.current.get(p.id);
        if (!el) continue;
        const { x, y, z } = project(p.lat, p.lng, phi.current, THETA, radius);
        if (z <= -0.15) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        const depth = Math.max(0, Math.min(1, (z + 0.15) / 1.15));
        const scale = 0.55 + depth * 0.55;
        el.style.opacity = String(0.35 + depth * 0.65);
        el.style.pointerEvents = "auto";
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.transform = `translate3d(${centerX + x}px, ${centerY + y}px, 0) translate(-50%, -50%) scale(${scale})`;
      }

      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    setTimeout(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(frame);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-[320px] sm:max-w-115 md:max-w-140 lg:max-w-155"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current =
            e.clientX - pointerInteractionMovement.current;
          if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            phi.current = delta / 200;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            phi.current = delta / 100;
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1s ease",
        }}
      />

      {points.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) avatarRefs.current.set(p.id, el);
            else avatarRefs.current.delete(p.id);
          }}
          title={p.label}
          className="pointer-events-none absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0 }}
        >
          <div
            className={
              p.isOrigin
                ? "h-8 w-8 overflow-hidden rounded-full ring-2 ring-white sm:h-9 sm:w-9"
                : "h-5 w-5 overflow-hidden rounded-full ring-1 ring-white/70 sm:h-6 sm:w-6"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.avatar_url}
              alt={p.label}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
