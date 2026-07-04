// Minimal canvas confetti — no dependency. Callers must respect the learner's
// reduced-motion preference (both the app setting and the OS media query).

const COLORS = ['#D95F0A', '#F5A040', '#C8880A', '#006E6D', '#5C1415', '#1A6B3F'];

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function burstConfetti(durationMs = 1600): void {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) { canvas.remove(); return; }
  g.scale(dpr, dpr);

  const W = window.innerWidth;
  const pieces = Array.from({ length: 110 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.4,
    y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -(4 + Math.random() * 8),
    w: 5 + Math.random() * 6,
    h: 8 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  const started = performance.now();
  const frame = (now: number) => {
    const t = now - started;
    g.clearRect(0, 0, W, window.innerHeight);
    for (const p of pieces) {
      p.vy += 0.25; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, 1 - t / durationMs);
      g.fillStyle = p.color;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (t < durationMs) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
