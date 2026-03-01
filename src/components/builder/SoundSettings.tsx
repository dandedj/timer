import { useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { AudioSettings, SoundPreset } from '../../types/timer';
import { AudioEngine, DEFAULT_AUDIO_SETTINGS } from '../../engine/audioEngine';

interface SoundSettingsProps {
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
}

const PRESETS: { value: SoundPreset; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'soft', label: 'Soft' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'bell', label: 'Bell' },
];

export function SoundSettings({ settings, onChange }: SoundSettingsProps) {
  const previewRef = useRef<AudioEngine | null>(null);

  const preview = (preset: SoundPreset) => {
    if (!previewRef.current) {
      previewRef.current = new AudioEngine({ ...settings, preset });
    } else {
      previewRef.current.updateSettings({ ...settings, preset });
    }
    previewRef.current.playPreview();
  };

  const setPreset = (preset: SoundPreset) => {
    onChange({ ...settings, preset });
    preview(preset);
  };

  const toggleCountdown = () => {
    onChange({ ...settings, countdownEnabled: !settings.countdownEnabled });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              settings.preset === p.value
                ? 'bg-white/25 text-white'
                : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/70'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={toggleCountdown}
        className={`p-1.5 rounded-lg transition-colors ${
          settings.countdownEnabled
            ? 'bg-white/15 text-white/80 hover:bg-white/20'
            : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
        }`}
        title={`Countdown beeps ${settings.countdownEnabled ? 'on' : 'off'}`}
      >
        {settings.countdownEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
      </button>
    </div>
  );
}

export { DEFAULT_AUDIO_SETTINGS };
