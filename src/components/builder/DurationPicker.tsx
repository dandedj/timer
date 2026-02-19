interface DurationPickerProps {
  value: number;
  onChange: (seconds: number) => void;
  label?: string;
}

export function DurationPicker({ value, onChange, label }: DurationPickerProps) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  const handleChange = (m: number, s: number) => {
    const clamped = Math.max(0, m * 60 + s);
    onChange(clamped);
  };

  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-sm text-gray-500 mr-2">{label}</span>}
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
    </div>
  );
}
