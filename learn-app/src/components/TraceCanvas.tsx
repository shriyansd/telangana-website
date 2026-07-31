// Trace-to-learn canvas. The learner draws each stroke of a letter with
// finger or mouse over stage-dependent guides:
//   stage 1 — faded glyph + stroke guides + direction arrows
//   stage 2 — faded glyph only (recall the order)
//   stage 3 — just the starting dot (draw from memory)
//   stage 4 — blank canvas
// Checking is deliberately generous (start/end/direction/coarse shape via
// lib/trace.ts) — this reinforces muscle memory, it does not grade precision.

import { useEffect, useRef, useState } from 'react';
import type { StrokePoints } from '../content/stroke-data';
import { checkStroke, smoothPath, startAngle } from '../lib/trace';

export type TraceStage = 1 | 2 | 3 | 4;

export interface TraceResult {
  /** strokes passed without needing the show-me hint */
  cleanStrokes: number;
  totalStrokes: number;
  usedHint: boolean;
  elapsedMs: number;
}

// Tolerance grows at memory stages so they feel encouraging, not punishing.
const TOLERANCE: Record<TraceStage, number> = { 1: 18, 2: 20, 3: 24, 4: 26 };
const MISSES_BEFORE_HINT = 2;

const ENCOURAGE: Record<string, string> = {
  start: 'Start a little closer to the dot.',
  end: 'Good, carry the stroke a bit further.',
  direction: 'Right shape, try drawing it the other way.',
  shape: 'Almost, follow the letter a little closer.',
  length: 'Draw the whole stroke in one motion.',
};

export function TraceCanvas({
  glyph,
  strokes,
  stage,
  onComplete,
}: {
  glyph: string;
  strokes: StrokePoints[];
  stage: TraceStage;
  onComplete: (result: TraceResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokeIdx, setStrokeIdx] = useState(0);
  const [misses, setMisses] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const doneStrokes = useRef<StrokePoints[]>([]);
  const liveStroke = useRef<StrokePoints>([]);
  const drawing = useRef(false);
  const usedHintEver = useRef(false);
  const cleanCount = useRef(0);
  const startedAt = useRef(0);
  const finishedRef = useRef(false);

  // Reset when the letter or stage changes.
  useEffect(() => {
    setStrokeIdx(0);
    setMisses(0);
    setShowHint(false);
    setMessage(null);
    doneStrokes.current = [];
    liveStroke.current = [];
    usedHintEver.current = false;
    cleanCount.current = 0;
    startedAt.current = 0;
    finishedRef.current = false;
    draw(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph, stage]);

  // Redraw on theme/size changes and on state we track manually.
  useEffect(() => {
    const onResize = () => draw(strokeIdx, showHint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeIdx, showHint]);

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

  /** Repaint everything up to `idx` completed strokes. */
  function draw(idx: number, hint: boolean, live?: StrokePoints) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size * dpr) { canvas.width = size * dpr; canvas.height = size * dpr; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = (size * dpr) / 100; // 100-space → device px
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, 100, 100);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Stage guides
    if (stage <= 2) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = css('--text');
      ctx.font = '72px "Noto Sans Telugu", "Nirmala UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(glyph, 50, 79);
      ctx.globalAlpha = 1;
    }
    if (stage === 1 || hint) {
      // Guide paths — all at stage 1, only the current stroke as a hint.
      const guideIdxs = stage === 1 ? strokes.map((_, i) => i) : [idx];
      for (const i of guideIdxs) {
        if (i >= strokes.length || i < idx) continue;
        drawPolyline(ctx, strokes[i], css('--muted'), 2.4, 0.35);
        drawArrow(ctx, strokes[i]);
      }
    }
    if (stage <= 3 && idx < strokes.length) {
      // Starting dot for the current stroke (all stages except blank canvas).
      const [x, y] = strokes[idx][0];
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = css('--saffron');
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Learner ink: completed strokes, then the live one.
    for (const st of doneStrokes.current) drawPolyline(ctx, st, css('--teal'), 3.4, 1);
    if (live && live.length > 1) drawPolyline(ctx, live, css('--saffron'), 3.4, 1);
  }

  function drawPolyline(ctx: CanvasRenderingContext2D, pts: StrokePoints, color: string, width: number, alpha: number) {
    if (pts.length < 2) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    const p = new Path2D(smoothPath(pts));
    ctx.stroke(p);
    ctx.globalAlpha = 1;
  }

  function drawArrow(ctx: CanvasRenderingContext2D, stroke: StrokePoints) {
    const [x, y] = stroke[0];
    const a = startAngle(stroke);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = css('--saffron');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2, 0); ctx.lineTo(8, 0);
    ctx.moveTo(5, -3); ctx.lineTo(8, 0); ctx.lineTo(5, 3);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const toLocal = (e: PointerEvent | React.PointerEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (finishedRef.current || strokeIdx >= strokes.length) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    if (!startedAt.current) startedAt.current = performance.now();
    liveStroke.current = [toLocal(e)];
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    liveStroke.current.push(toLocal(e));
    draw(strokeIdx, showHint, liveStroke.current);
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const attempt = liveStroke.current;
    liveStroke.current = [];
    if (attempt.length < 2) { draw(strokeIdx, showHint); return; }

    const expected = strokes[strokeIdx];
    const result = checkStroke(attempt, expected, TOLERANCE[stage]);
    if (result.ok) {
      doneStrokes.current.push(attempt);
      if (!showHint) cleanCount.current += 1;
      const next = strokeIdx + 1;
      setMisses(0);
      setShowHint(false);
      setMessage(null);
      setStrokeIdx(next);
      draw(next, false);
      if (next >= strokes.length && !finishedRef.current) {
        finishedRef.current = true;
        onComplete({
          cleanStrokes: cleanCount.current,
          totalStrokes: strokes.length,
          usedHint: usedHintEver.current,
          elapsedMs: Math.round(performance.now() - startedAt.current),
        });
      }
    } else {
      const missCount = misses + 1;
      setMisses(missCount);
      setMessage(ENCOURAGE[result.problem ?? 'shape']);
      if (missCount >= MISSES_BEFORE_HINT && stage > 1) {
        setShowHint(true);
        usedHintEver.current = true;
        draw(strokeIdx, true);
      } else {
        draw(strokeIdx, showHint);
      }
    }
  };

  const restart = () => {
    doneStrokes.current = [];
    cleanCount.current = 0;
    finishedRef.current = false;
    setStrokeIdx(0);
    setMisses(0);
    setShowHint(false);
    setMessage(null);
    draw(0, false);
  };

  const finished = strokeIdx >= strokes.length;

  return (
    <div className="trace-wrap">
      <div className="trace-status" aria-live="polite">
        {finished
          ? <strong className="trace-done-msg">బాగుంది! Letter complete 🎉</strong>
          : <>Stroke {strokeIdx + 1} of {strokes.length}{message && <span className="trace-nudge"> · {message}</span>}</>}
      </div>
      <canvas
        ref={canvasRef}
        className="trace-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={`Tracing area for ${glyph}, stroke ${Math.min(strokeIdx + 1, strokes.length)} of ${strokes.length}`}
      />
      <div className="trace-actions">
        <button type="button" className="btn-ghost" onClick={restart}>↺ Start over</button>
        {!finished && stage > 1 && !showHint && (
          <button
            type="button" className="btn-ghost"
            onClick={() => { setShowHint(true); usedHintEver.current = true; draw(strokeIdx, true); }}
          >💡 Show me this stroke</button>
        )}
      </div>
    </div>
  );
}
