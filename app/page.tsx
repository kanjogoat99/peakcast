"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BurstKind = "none" | "game" | "media";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  size: number;
  rot: number;
  vr: number;
  hollow: boolean;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function makeParticles(kind: BurstKind, x: number, y: number): Particle[] {
  const count = kind === "game" ? 55 : 45;

  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Emit mostly upward, with some spread (like the video)
    const angle = rand(-Math.PI * 0.9, -Math.PI * 0.1);
    const speed = kind === "game" ? rand(140, 360) : rand(110, 280);

    const vx = Math.cos(angle) * speed + rand(-60, 60);
    const vy = Math.sin(angle) * speed + rand(-40, 40);

    out.push({
      x,
      y,
      vx,
      vy,
      life: 1,
      size: kind === "game" ? rand(4, 10) : rand(3, 9),
      rot: rand(0, Math.PI * 2),
      vr: rand(-6, 6),
      hollow: kind === "media" ? Math.random() < 0.35 : false, // hollow circles like your clip
    });
  }
  return out;
}

function BurstCanvas({
  active,
  kind,
}: {
  active: boolean;
  kind: BurstKind;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastTRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!active || kind === "none") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    // Burst origin: center-ish vertically, near title
    const originX = rect.width / 2;
    const originY = rect.height / 2;

    particlesRef.current = makeParticles(kind, originX, originY);

    lastTRef.current = performance.now();

    const tick = (t: number) => {
      const dt = clamp((t - lastTRef.current) / 1000, 0, 0.033);
      lastTRef.current = t;

      ctx.clearRect(0, 0, rect.width, rect.height);

      const g = kind === "game" ? 520 : 420; // gravity
      const drag = kind === "game" ? 0.86 : 0.88;

      const particles = particlesRef.current;

      for (const p of particles) {
        // Physics
        p.vy += g * dt;
        p.vx *= Math.pow(drag, dt * 60);
        p.vy *= Math.pow(drag, dt * 60);

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.rot += p.vr * dt;

        // Fade out
        p.life -= dt * (kind === "game" ? 1.35 : 1.2);
        p.life = clamp(p.life, 0, 1);

        const a = p.life;

        if (a <= 0) continue;

        if (kind === "game") {
          // White cube pixels (squares) with slight rotation
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = a;
          ctx.fillStyle = "rgba(255,255,255,1)";
          const s = p.size;
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          // Media particles: mix of filled + hollow circles, pink/magenta tones
          ctx.save();
          ctx.globalAlpha = a;

          const isHot = Math.random() < 0.5;
          const fill = isHot ? "#d10b66" : "#ff5aa5";
          const stroke = isHot ? "#ff5aa5" : "#d10b66";

          const r = p.size / 2;

          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);

          if (p.hollow) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = stroke;
            ctx.stroke();
          } else {
            ctx.fillStyle = fill;
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // Remove dead particles
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // stop
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
    };
  }, [active, kind]);

  return (
    <canvas
      ref={canvasRef}
      className="burstCanvas"
      aria-hidden="true"
    />
  );
}

export default function HomePage() {
  const router = useRouter();
  const [pressed, setPressed] = useState<BurstKind>("none");

  const go = (kind: BurstKind) => {
    setPressed(kind);

    // Let the burst show briefly, then navigate
    window.setTimeout(() => {
      router.push(kind === "game" ? "/game" : "/media");
    }, 220);
  };

  return (
    <main className="splitRoot">
      {/* Left: Game Hub */}
      <section
        className={`panel panelGame ${pressed === "game" ? "isPressed" : ""}`}
        onPointerDown={() => go("game")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? go("game") : null)}
        aria-label="Open Game Hub"
      >
        <BurstCanvas active={pressed === "game"} kind="game" />
        <div className="panelInner">
          <h1 className="title gameTitle">
            <span className="titleGlow">{pressed === "game" ? "GAME HUB" : "GAME HUB"}</span>
          </h1>
          <p className="subtitle gameSubtitle">Tap to enter</p>
        </div>
      </section>

      {/* Right: Media Hub */}
      <section
        className={`panel panelMedia ${pressed === "media" ? "isPressed" : ""}`}
        onPointerDown={() => go("media")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? go("media") : null)}
        aria-label="Open Media Hub"
      >
        <BurstCanvas active={pressed === "media"} kind="media" />
        <div className="panelInner">
          <h1 className="title mediaTitle">
            <span className="titleGlow">{pressed === "media" ? "MEDIA HUB" : "MEDIA HUB"}</span>
          </h1>
          <p className="subtitle mediaSubtitle">Tap to enter</p>
        </div>
      </section>
    </main>
  );
  }
