export class AudioEngine {
  private ctx: AudioContext | null = null;

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
    if (isRest) {
      this.beep(440, 0.6, 0.3);
    } else {
      this.beep(880, 0.3, 0.15);
      this.beep(880, 0.3, 0.15, 0.2);
    }
  }

  playCountdown(secondsRemaining: number): void {
    if (!this.ctx) return;
    if (secondsRemaining <= 3 && secondsRemaining > 0) {
      this.beep(660, 0.1, 0.1);
    }
  }

  playFinish(): void {
    if (!this.ctx) return;
    this.beep(523, 0.4, 0.2);
    this.beep(659, 0.4, 0.2, 0.25);
    this.beep(784, 0.6, 0.3, 0.5);
  }

  private beep(
    frequency: number,
    duration: number,
    volume: number,
    delaySeconds = 0
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    const startTime = this.ctx.currentTime + delaySeconds;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}
