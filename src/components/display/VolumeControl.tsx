import { useState, useRef, useEffect } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { getVolume, persistVolume } from '../../engine/volume';

interface VolumeControlProps {
  /** Apply the new volume to the running engine. */
  onChange: (volume: number) => void;
  /** Play a sample tone so the level can be heard while adjusting. */
  onPreview: () => void;
}

export function VolumeControl({ onChange, onPreview }: VolumeControlProps) {
  const [volume, setVolume] = useState(() => getVolume());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastPreview = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const change = (v: number) => {
    setVolume(v);
    onChange(v);
    persistVolume(v);
    const now = Date.now();
    if (v > 0 && now - lastPreview.current > 250) {
      lastPreview.current = now;
      onPreview();
    }
  };

  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const pct = Math.round(volume * 100);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Volume"
        className="flex items-center justify-center p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors"
      >
        <Icon size={18} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-30 flex items-center gap-2 bg-black/70 backdrop-blur rounded-xl px-3 py-2 shadow-xl">
          <Icon size={16} className="text-white/70 shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => change(Number(e.target.value) / 100)}
            className="w-32 accent-white cursor-pointer"
            aria-label="Volume"
          />
          <span className="text-xs font-mono text-white/70 w-9 text-right shrink-0">{pct}%</span>
        </div>
      )}
    </div>
  );
}
