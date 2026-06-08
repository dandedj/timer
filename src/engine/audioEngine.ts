import type { SoundPreset, AudioSettings } from '../types/timer';
import { getVolume } from './volume';

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

// Beeps are intentionally loud and long so they carry across a noisy class.
// A user-adjustable master volume (0–1) scales all of these down as needed.
const PRESET_CONFIGS: Record<SoundPreset, PresetConfig> = {
  classic: {
    waveform: 'sine',
    transition: { workFreq: 880, restFreq: 440, volume: 0.5, duration: 0.6 },
    countdown: { freq: 660, volume: 0.32, duration: 0.22 },
    finish: { notes: [523, 659, 784], volume: 0.5, duration: 0.6 },
  },
  soft: {
    waveform: 'sine',
    transition: { workFreq: 600, restFreq: 330, volume: 0.3, duration: 0.6 },
    countdown: { freq: 500, volume: 0.2, duration: 0.25 },
    finish: { notes: [440, 554, 659], volume: 0.32, duration: 0.6 },
  },
  sharp: {
    waveform: 'square',
    transition: { workFreq: 1000, restFreq: 500, volume: 0.28, duration: 0.35 },
    countdown: { freq: 800, volume: 0.18, duration: 0.16 },
    finish: { notes: [587, 740, 880], volume: 0.3, duration: 0.4 },
  },
  bell: {
    waveform: 'triangle',
    transition: { workFreq: 1200, restFreq: 600, volume: 0.42, duration: 0.8 },
    countdown: { freq: 900, volume: 0.28, duration: 0.35 },
    finish: { notes: [523, 698, 880], volume: 0.45, duration: 0.8 },
  },
  // The loudest, most attention-grabbing option (harsh sawtooth, high gain).
  strong: {
    waveform: 'sawtooth',
    transition: { workFreq: 784, restFreq: 392, volume: 0.7, duration: 0.7 },
    countdown: { freq: 660, volume: 0.5, duration: 0.28 },
    finish: { notes: [523, 659, 784], volume: 0.75, duration: 0.85 },
  },
  // Low, blaring air-horn style — carries through music and chatter.
  horn: {
    waveform: 'sawtooth',
    transition: { workFreq: 330, restFreq: 247, volume: 0.62, duration: 0.95 },
    countdown: { freq: 392, volume: 0.42, duration: 0.3 },
    finish: { notes: [330, 392, 494], volume: 0.62, duration: 1.1 },
  },
  // Piercing coach-whistle (high square tone).
  whistle: {
    waveform: 'square',
    transition: { workFreq: 1800, restFreq: 1500, volume: 0.32, duration: 0.4 },
    countdown: { freq: 2100, volume: 0.24, duration: 0.14 },
    finish: { notes: [1800, 2100, 2400], volume: 0.34, duration: 0.45 },
  },
  // Deep boxing-bell / gong for round changes.
  gong: {
    waveform: 'triangle',
    transition: { workFreq: 196, restFreq: 147, volume: 0.6, duration: 1.1 },
    countdown: { freq: 330, volume: 0.34, duration: 0.32 },
    finish: { notes: [196, 261, 330], volume: 0.62, duration: 1.3 },
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private masterVolume: number;

  constructor(settings?: AudioSettings) {
    this.settings = settings ?? DEFAULT_AUDIO_SETTINGS;
    this.masterVolume = getVolume();
  }

  updateSettings(settings: AudioSettings): void {
    this.settings = settings;
  }

  /** Set the master volume (0–1). Applied to every subsequent beep. */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.min(1, Math.max(0, volume));
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

  /** Audible cue when the timer is started/resumed (also unlocks audio on the gesture). */
  playStart(isRest: boolean): void {
    this.unlock();
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
    const level = volume * this.masterVolume;
    if (level <= 0.001) return; // muted / inaudible

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    const startTime = this.ctx.currentTime + delaySeconds;
    gain.gain.setValueAtTime(level, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}
