interface DurationPickerProps {
  value: number;
  onChange: (seconds: number) => void;
  label?: string;
  presets?: number[];
}

export function DurationPicker({ value, onChange, label, presets }: DurationPickerProps) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  const isPreset = presets?.includes(value);

  const handleChange = (m: number, s: number) => {
    const clamped = Math.max(0, m * 60 + s);
    onChange(clamped);
  };

  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-sm text-gray-500 mr-2">{label}</span>}
      {presets && (
        <div className="flex gap-1 mr-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                value === p
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-brand-navy/50 hover:bg-gray-200 hover:text-brand-navy/70'
              }`}
            >
              {p}s
            </button>
          ))}
        </div>
      )}
      {(!presets || !isPreset) && (
        <>
          <input
            type="number"
            min={0}
            max={99}
            value={minutes}
            onChange={(e) => {
              const m = parseInt(e.target.value) || 0;
              handleChange(m, seconds);
            }}
            className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-sm"
          />
          <span className="text-gray-400">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={seconds.toString().padStart(2, '0')}
            onChange={(e) => {
              const s = Math.min(59, parseInt(e.target.value) || 0);
              handleChange(minutes, s);
            }}
            className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-sm"
          />
        </>
      )}
    </div>
  );
}
