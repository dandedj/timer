import type { SoundPreset, AudioSettings } from '../types/timer';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  preset: 'classic',
  countdownEnabled: true,
};

type OscType = OscillatorType;

interface PresetConfig {
  waveform: OscType;
  transition: { workFreq: number; restFreq: number; volume: number; duration: number };
  countdown: { freq: number; volume: number; duration: number };
  finish: { notes: [number, number, number]; volume: number; duration: number };
}

const PRESET_CONFIGS: Record<SoundPreset, PresetConfig> = {
  classic: {
    waveform: 'sine',
    transition: { workFreq: 880, restFreq: 440, volume: 0.15, duration: 0.3 },
    countdown: { freq: 660, volume: 0.1, duration: 0.1 },
    finish: { notes: [523, 659, 784], volume: 0.25, duration: 0.3 },
  },
  soft: {
    waveform: 'sine',
    transition: { workFreq: 600, restFreq: 330, volume: 0.08, duration: 0.4 },
    countdown: { freq: 500, volume: 0.05, duration: 0.15 },
    finish: { notes: [440, 554, 659], volume: 0.12, duration: 0.4 },
  },
  sharp: {
    waveform: 'square',
    transition: { workFreq: 1000, restFreq: 500, volume: 0.06, duration: 0.15 },
    countdown: { freq: 800, volume: 0.04, duration: 0.06 },
    finish: { notes: [587, 740, 880], volume: 0.08, duration: 0.2 },
  },
  bell: {
    waveform: 'triangle',
    transition: { workFreq: 1200, restFreq: 600, volume: 0.12, duration: 0.5 },
    countdown: { freq: 900, volume: 0.08, duration: 0.2 },
    finish: { notes: [523, 698, 880], volume: 0.18, duration: 0.5 },
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;

  constructor(settings?: AudioSettings) {
    this.settings = settings ?? DEFAULT_AUDIO_SETTINGS;
  }

  updateSettings(settings: AudioSettings): void {
    this.settings = settings;
  }

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTransition(isRest: boolean): void {
    if (!this.ctx) return;
    const config = PRESET_CONFIGS[this.settings.preset];
    const freq = isRest ? config.transition.restFreq : config.transition.workFreq;
    this.beep(freq, config.transition.duration, config.transition.volume, 0, config.waveform);
    if (!isRest) {
      this.beep(freq, config.transition.duration, config.transition.volume, 0.2, config.waveform);
    }
  }

  playCountdown(secondsRemaining: number): void {
    if (!this.ctx) return;
    if (!this.settings.countdownEnabled) return;
    if (secondsRemaining <= 3 && secondsRemaining > 0) {
      const config = PRESET_CONFIGS[this.settings.preset];
      this.beep(config.countdown.freq, config.countdown.duration, config.countdown.volume, 0, config.waveform);
    }
  }

  playFinish(): void {
    if (!this.ctx) return;
    const config = PRESET_CONFIGS[this.settings.preset];
    const [n1, n2, n3] = config.finish.notes;
    this.beep(n1, config.finish.duration, config.finish.volume, 0, config.waveform);
    this.beep(n2, config.finish.duration, config.finish.volume, 0.25, config.waveform);
    this.beep(n3, config.finish.duration + 0.1, config.finish.volume + 0.05, 0.5, config.waveform);
  }

  playPreview(): void {
    this.unlock();
    if (!this.ctx) return;
    const config = PRESET_CONFIGS[this.settings.preset];
    this.beep(config.transition.workFreq, config.transition.duration, config.transition.volume, 0, config.waveform);
  }

  private beep(
    frequency: number,
    duration: number,
    volume: number,
    delaySeconds = 0,
    waveform: OscType = 'sine'
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    const startTime = this.ctx.currentTime + delaySeconds;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}
