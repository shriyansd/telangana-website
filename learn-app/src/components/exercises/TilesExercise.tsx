// Word-tile builder: tap/click or keyboard to arrange tiles. Fully usable
// without drag-and-drop (tap a tile to add, tap again to remove).

import { useEffect, useState } from 'react';

export function TileBuilder({
  tiles,
  onChange,
  disabled,
}: {
  tiles: string[];
  onChange: (arranged: string[]) => void;
  disabled?: boolean;
}) {
  // Each tile instance is tracked by index so duplicate words work.
  const [placedIdx, setPlacedIdx] = useState<number[]>([]);

  useEffect(() => { setPlacedIdx([]); }, [tiles]);

  useEffect(() => {
    onChange(placedIdx.map((i) => tiles[i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedIdx]);

  const place = (i: number) => {
    if (disabled || placedIdx.includes(i)) return;
    setPlacedIdx([...placedIdx, i]);
  };
  const remove = (pos: number) => {
    if (disabled) return;
    setPlacedIdx(placedIdx.filter((_, p) => p !== pos));
  };

  return (
    <div className="tiles-exercise">
      <div className="tile-answer-row" aria-label="Your sentence" role="group">
        {placedIdx.length === 0 && <span className="tile-placeholder">Tap the tiles below in order…</span>}
        {placedIdx.map((i, pos) => (
          <button type="button" key={`${i}-${pos}`} lang="te" className="tile placed" onClick={() => remove(pos)} aria-label={`Remove ${tiles[i]}`}>
            {tiles[i]}
          </button>
        ))}
      </div>
      <div className="tile-bank" role="group" aria-label="Available word tiles">
        {tiles.map((t, i) => (
          <button
            type="button"
            key={i}
            lang="te"
            className={`tile ${placedIdx.includes(i) ? 'used' : ''}`}
            onClick={() => place(i)}
            disabled={disabled || placedIdx.includes(i)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
