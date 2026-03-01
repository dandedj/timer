import { useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { AudioSettings, SoundPreset } from '../../types/timer';
import { AudioEngine, DEFAULT_AUDIO_SETTINGS } from '../../engine/audioEngine';

interface SoundSettingsProps {
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
}

const PRESETS: { value: SoundPreset; label: string; description: string }[] = [
  { value: 'classic', label: 'Classic', description: 'Clean sine tones' },
  { value: 'soft', label: 'Soft', description: 'Gentle, low tones' },
  { value: 'sharp', label: 'Sharp', description: 'Punchy, crisp beeps' },
  { value: 'bell', label: 'Bell', description: 'Bright, chime-like' },
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-brand-navy/70 uppercase tracking-wider">Sounds</h3>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              settings.preset === p.value
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-brand-navy/60 hover:bg-gray-200 hover:text-brand-navy'
            }`}
            title={p.description}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={toggleCountdown}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
          settings.countdownEnabled
            ? 'text-brand-navy/70 hover:text-brand-navy'
            : 'text-brand-navy/40 hover:text-brand-navy/60'
        }`}
      >
        {settings.countdownEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        Countdown beeps {settings.countdownEnabled ? 'on' : 'off'}
      </button>
    </div>
  );
}

export { DEFAULT_AUDIO_SETTINGS };
