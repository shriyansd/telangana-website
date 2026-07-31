// Animated stroke-order demonstration. The letter shape is the real font
// glyph rendered faded; strokes from stroke-data animate over it one at a
// time with a moving dot and a start arrow. Auto-plays once, then offers
// replay. With reduced motion on, shows all strokes statically, numbered.

import { useEffect, useRef, useState } from 'react';
import type { StrokePoints } from '../content/stroke-data';
import { smoothPath, startAngle } from '../lib/trace';
import { useApp } from '../AppContext';

const STROKE_MS = 900;
const GAP_MS = 350;

export function StrokeAnimation({ glyph, strokes }: { glyph: string; strokes: StrokePoints[] }) {
  const { settings } = useApp();
  const reduced = settings.reducedMotion;
  // progress: index of stroke being drawn; t within it 0..1. done = all drawn.
  const [drawn, setDrawn] = useState(0); // strokes fully drawn
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const raf = useRef(0);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [dot, setDot] = useState<[number, number] | null>(null);

  const play = () => {
    setDrawn(0);
    setT(0);
    setPlaying(true);
  };

  useEffect(() => { if (!reduced) play(); else { setPlaying(false); setDrawn(strokes.length); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph]);

  useEffect(() => {
    if (!playing) return;
    let stroke = 0;
    let start = performance.now() + GAP_MS;
    const tick = (now: number) => {
      if (stroke >= strokes.length) { setPlaying(false); setDot(null); return; }
      const p = (now - start) / STROKE_MS;
      if (p >= 1) {
        stroke += 1;
        setDrawn(stroke);
        setT(0);
        start = now + GAP_MS;
      } else if (p >= 0) {
        setDrawn(stroke);
        setT(p);
        const el = pathRefs.current[stroke];
        if (el) {
          const len = el.getTotalLength();
          const pt = el.getPointAtLength(len * p);
          setDot([pt.x, pt.y]);
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, strokes]);

  const finished = !playing;
  const current = drawn; // stroke currently animating

  return (
    <div className="stroke-anim">
      <svg viewBox="0 0 100 100" className="stroke-anim-svg" role="img" aria-label={`Stroke order for ${glyph}`}>
        <text x="50" y="79" textAnchor="middle" className="stroke-guide-glyph" lang="te">{glyph}</text>
        {strokes.map((s, i) => {
          const visible = i < drawn || (playing && i === current) || finished;
          if (!visible) return null;
          const partial = playing && i === current;
          return (
            <path
              key={i}
              ref={(el) => { pathRefs.current[i] = el; }}
              d={smoothPath(s)}
              className={`stroke-path ${partial ? 'drawing' : ''}`}
              style={partial ? { strokeDasharray: 1, strokeDashoffset: 1 - t } : undefined}
              pathLength={partial ? 1 : undefined}
            />
          );
        })}
        {/* start arrows: during play show the current stroke's; when finished (or reduced motion) show all, numbered */}
        {strokes.map((s, i) => {
          const show = finished || (playing && i === current);
          if (!show) return null;
          const a = (startAngle(s) * 180) / Math.PI;
          return (
            <g key={`a${i}`} transform={`translate(${s[0][0]} ${s[0][1]})`} className="stroke-start">
              <g transform={`rotate(${a})`}>
                <path d="M -2 0 L 7 0 M 4 -3 L 7 0 L 4 3" className="stroke-arrow" />
              </g>
              {finished && strokes.length > 1 && (
                <text className="stroke-num" x="-4" y="-3">{i + 1}</text>
              )}
            </g>
          );
        })}
        {playing && dot && <circle cx={dot[0]} cy={dot[1]} r="3" className="stroke-dot" />}
      </svg>
      <button type="button" className="btn-ghost stroke-replay" onClick={play} disabled={playing}>
        ▶ Replay strokes
      </button>
    </div>
  );
}
