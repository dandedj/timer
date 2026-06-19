import type { FlatInterval, AudioSettings } from '../types/timer';
import type { EngineState, EngineSnapshot } from '../types/engine';
import { AudioEngine } from './audioEngine';

type StateListener = (snapshot: EngineSnapshot) => void;

/** Past this many seconds into an exercise, "previous" restarts it instead of stepping back. */
const PREVIOUS_RESTART_THRESHOLD_SECONDS = 3;

export class TimerEngine {
  private worker: Worker;
  private audio: AudioEngine;
  private state: EngineState;
  private listeners: Set<StateListener> = new Set();
  private rafHandle: number | null = null;
  private lastWorkerTickMs: number = 0;
  private lastWorkerTickWallMs: number = 0;
  private accumulatedMs: number = 0;
  private lastCountdownBeep: number = -1;

  constructor() {
    this.worker = new Worker(
      new URL('./timerWorker.ts', import.meta.url),
      { type: 'module' }
    );
    this.audio = new AudioEngine();
    this.state = this.makeIdleState([]);
    this.worker.onmessage = this.handleWorkerTick.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  load(sequence: FlatInterval[]): void {
    this.stop();
    this.state = this.makeIdleState(sequence);
    this.notifyListeners();
  }

  play(): void {
    // Allow restarting from finished state
    if (this.state.status === 'finished') {
      this.reset();
    }
    if (this.state.status === 'idle' || this.state.status === 'paused') {
      const wasIdle = this.state.status === 'idle';
      this.audio.unlock();
      // Audible feedback that the timer started/resumed.
      const current = this.state.sequence[this.state.currentIndex];
      this.audio.playStart(current ? current.kind !== 'work' : false);
      this.state.status = 'running';
      this.lastWorkerTickMs = 0; // will be set on first tick
      if (wasIdle) {
        this.accumulatedMs = 0;
      }
      this.worker.postMessage({ cmd: 'start' });
      this.startRaf();
    }
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
      this.worker.postMessage({ cmd: 'stop' });
      this.stopRaf();
      this.notifyListeners();
    }
  }

  reset(): void {
    this.stop();
    this.state = this.makeIdleState(this.state.sequence);
    this.notifyListeners();
  }

  skipForward(): void {
    if (this.state.status === 'finished') return;
    if (this.state.sequence.length === 0) return;

    // Add remaining time of current interval to elapsed
    this.state.elapsedTotalSeconds += this.state.ticksRemaining / 100;
    this.state.ticksRemaining = 0;

    const nextIndex = this.state.currentIndex + 1;
    if (nextIndex >= this.state.sequence.length) {
      this.state.status = 'finished';
      this.worker.postMessage({ cmd: 'stop' });
      this.stopRaf();
      this.audio.playFinish();
      this.notifyListeners();
      return;
    }

    this.state.currentIndex = nextIndex;
    const next = this.state.sequence[nextIndex];
    this.state.ticksRemaining = Math.max(1, next.durationSeconds * 100);
    this.lastCountdownBeep = -1;
    this.audio.playTransition(next.kind !== 'work');
    this.notifyListeners();
  }

  skipBack(): void {
    if (this.state.sequence.length === 0) return;

    const current = this.state.sequence[this.state.currentIndex];
    const currentFullTicks = current.durationSeconds * 100;
    const elapsedInCurrentSeconds = (currentFullTicks - this.state.ticksRemaining) / 100;

    // Subtract time spent in current interval
    this.state.elapsedTotalSeconds = Math.max(0, this.state.elapsedTotalSeconds - elapsedInCurrentSeconds);

    if (this.state.currentIndex > 0) {
      this.state.currentIndex--;
      const prev = this.state.sequence[this.state.currentIndex];
      this.state.ticksRemaining = Math.max(1, prev.durationSeconds * 100);
      // Subtract previous interval's full duration since we're replaying it
      this.state.elapsedTotalSeconds = Math.max(0, this.state.elapsedTotalSeconds - prev.durationSeconds);
    } else {
      // Restart current interval
      this.state.ticksRemaining = Math.max(1, currentFullTicks);
    }

    this.lastCountdownBeep = -1;

    if (this.state.status === 'finished') {
      this.state.status = 'paused';
    }

    this.audio.playTransition(this.state.sequence[this.state.currentIndex].kind !== 'work');
    this.notifyListeners();
  }

  /**
   * "Previous" at exercise granularity (music-player semantics): a few seconds
   * into the current exercise it restarts that exercise; at the very start — or
   * while resting between exercises — it jumps to the start of the exercise
   * before this one, skipping over rest intervals.
   */
  previousExercise(): void {
    const seq = this.state.sequence;
    if (seq.length === 0) return;

    const idx = this.state.currentIndex;
    const current = seq[idx];
    const isExercise = (i: FlatInterval) => i.kind === 'work' || i.kind === 'warmup';

    // The exercise governing the current position: itself when we're on one,
    // otherwise the most recent exercise before this rest.
    let anchor = idx;
    while (anchor > 0 && !isExercise(seq[anchor])) anchor--;

    let target: number;
    if (!isExercise(current)) {
      // Resting between exercises: return to the start of the one that just ran.
      target = anchor;
    } else {
      const fullTicks = Math.max(1, current.durationSeconds * 100);
      const elapsedInCurrent = (fullTicks - this.state.ticksRemaining) / 100;
      if (elapsedInCurrent > PREVIOUS_RESTART_THRESHOLD_SECONDS) {
        // Mid-exercise: a single press restarts it.
        target = anchor; // === idx
      } else {
        // At the start: step back to the previous exercise, skipping rests.
        target = anchor;
        for (let i = anchor - 1; i >= 0; i--) {
          if (isExercise(seq[i])) {
            target = i;
            break;
          }
        }
      }
    }

    this.jumpToIndex(target);
  }

  /** Jump to a specific interval (by id), preserving the current transport state. */
  jumpTo(intervalId: string): void {
    const idx = this.state.sequence.findIndex((i) => i.id === intervalId);
    if (idx < 0) return;
    this.jumpToIndex(idx);
  }

  private jumpToIndex(idx: number): void {
    if (idx < 0 || idx >= this.state.sequence.length) return;

    let elapsed = 0;
    for (let i = 0; i < idx; i++) elapsed += this.state.sequence[i].durationSeconds;

    this.state.currentIndex = idx;
    this.state.ticksRemaining = Math.max(1, this.state.sequence[idx].durationSeconds * 100);
    // Elapsed = scheduled position in the workout (sum of prior interval durations),
    // not measured wall-clock — keeps the elapsed/remaining strip consistent after a jump.
    this.state.elapsedTotalSeconds = elapsed;
    this.lastCountdownBeep = -1;
    this.accumulatedMs = 0;

    if (this.state.status === 'running') {
      // Keep ticking without swallowing a tick (no re-baseline needed mid-run).
      this.lastWorkerTickMs = performance.now();
      this.lastWorkerTickWallMs = Date.now();
      this.audio.playTransition(this.state.sequence[idx].kind !== 'work');
    } else if (this.state.status === 'finished') {
      this.state.status = 'paused';
    }
    // Paused/idle: reposition only — no worker start, no RAF, no transition beep
    // (audio may not be unlocked yet, and beeping while stopped is wrong).
    this.notifyListeners();
  }

  /** Restore a previously saved position, landing paused at that point. */
  restore(intervalIndex: number, secondsRemaining: number): void {
    if (this.state.sequence.length === 0) return;

    const idx = Math.min(Math.max(0, Math.floor(intervalIndex)), this.state.sequence.length - 1);
    const fullTicks = Math.max(1, this.state.sequence[idx].durationSeconds * 100);
    const ticks = Math.min(Math.max(1, Math.round(secondsRemaining * 100)), fullTicks);

    let elapsed = 0;
    for (let i = 0; i < idx; i++) elapsed += this.state.sequence[i].durationSeconds;
    elapsed += (fullTicks - ticks) / 100;

    this.state.currentIndex = idx;
    this.state.ticksRemaining = ticks;
    this.state.elapsedTotalSeconds = elapsed;
    this.lastCountdownBeep = -1;
    this.accumulatedMs = 0;
    this.state.status = 'paused';
    this.notifyListeners();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.buildSnapshot());
    return () => this.listeners.delete(listener);
  }

  updateAudioSettings(settings: AudioSettings): void {
    this.audio.updateSettings(settings);
  }

  setVolume(volume: number): void {
    this.audio.setMasterVolume(volume);
  }

  /** Play a short sample tone (used as feedback while adjusting the volume). */
  previewBeep(): void {
    this.audio.playPreview();
  }

  destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.worker.terminate();
    this.audio.dispose();
  }

  private handleWorkerTick(): void {
    this.advanceClock();
  }

  private handleVisibilityChange = (): void => {
    // Coming back from a locked screen: reconcile against the wall clock
    // immediately instead of waiting for the next worker tick.
    if (document.visibilityState === 'visible') {
      this.advanceClock();
    }
  };

  private advanceClock(): void {
    if (this.state.status !== 'running') return;

    const now = performance.now();
    const wallNow = Date.now();
    // On first tick after play/resume, initialize timing baseline
    if (this.lastWorkerTickMs === 0) {
      this.lastWorkerTickMs = now;
      this.lastWorkerTickWallMs = wallNow;
      return;
    }
    const monotonicMs = now - this.lastWorkerTickMs;
    const wallMs = wallNow - this.lastWorkerTickWallMs;
    this.lastWorkerTickMs = now;
    this.lastWorkerTickWallMs = wallNow;
    // performance.now() can stall across device sleep (iPadOS), silently losing
    // locked-screen time. Trust the wall clock when it runs ahead by more than
    // 1s — large enough to ignore NTP jitter, small enough to catch sleep gaps.
    this.accumulatedMs += wallMs - monotonicMs > 1000 ? wallMs : monotonicMs;

    const centisecondsElapsed = Math.floor(this.accumulatedMs / 10);
    this.accumulatedMs -= centisecondsElapsed * 10;

    this.advance(centisecondsElapsed);
  }

  private advance(centiseconds: number): void {
    let remaining = centiseconds;
    let completions = 0;

    while (remaining > 0 && this.state.status === 'running') {
      if (this.state.ticksRemaining <= remaining) {
        remaining -= this.state.ticksRemaining;
        this.state.elapsedTotalSeconds += this.state.ticksRemaining / 100;
        this.state.ticksRemaining = 0;
        completions++;
        this.onIntervalComplete();
      } else {
        this.state.elapsedTotalSeconds += remaining / 100;
        this.state.ticksRemaining -= remaining;
        remaining = 0;
      }
    }

    // One transition cue per advance() call, for the interval actually landed
    // on: after a long suspension a single tick crosses many boundaries, and
    // per-boundary beeps would all land at the same AudioContext time as a
    // clipped chord. A catch-up that runs past the end plays only the finish.
    if (completions > 0 && this.state.status === 'running') {
      this.audio.playTransition(this.state.sequence[this.state.currentIndex].kind !== 'work');
    }

    const secondsLeft = Math.ceil(this.state.ticksRemaining / 100);
    if (secondsLeft <= 3 && secondsLeft > 0 && secondsLeft !== this.lastCountdownBeep) {
      this.lastCountdownBeep = secondsLeft;
      this.audio.playCountdown(secondsLeft);
    }
    if (secondsLeft > 3) {
      this.lastCountdownBeep = -1;
    }
  }

  private onIntervalComplete(): void {
    const nextIndex = this.state.currentIndex + 1;
    if (nextIndex >= this.state.sequence.length) {
      this.state.status = 'finished';
      this.worker.postMessage({ cmd: 'stop' });
      this.stopRaf();
      this.audio.playFinish();
      this.notifyListeners();
      return;
    }

    this.state.currentIndex = nextIndex;
    const next = this.state.sequence[nextIndex];
    // Enforce minimum 1 centisecond to prevent infinite loop on 0-second intervals
    this.state.ticksRemaining = Math.max(1, next.durationSeconds * 100);
  }

  private startRaf(): void {
    const loop = () => {
      this.notifyListeners();
      if (this.state.status === 'running') {
        this.rafHandle = requestAnimationFrame(loop);
      }
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  private stopRaf(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private notifyListeners(): void {
    const snapshot = this.buildSnapshot();
    this.listeners.forEach(l => l(snapshot));
  }

  private buildSnapshot(): EngineSnapshot {
    const { state } = this;
    const current = state.sequence[state.currentIndex] ?? null;
    const next = state.sequence[state.currentIndex + 1] ?? null;
    const upcoming = state.sequence.slice(state.currentIndex + 1, state.currentIndex + 6);

    return {
      status: state.status,
      current,
      next,
      upcoming,
      sequence: state.sequence,
      currentIndex: state.currentIndex,
      secondsRemaining: Math.ceil(state.ticksRemaining / 100),
      elapsedTotalSeconds: Math.floor(state.elapsedTotalSeconds),
      totalDurationSeconds: state.totalDurationSeconds,
      intervalIndex: current?.intervalIndexGlobal ?? 0,
      totalIntervals: current?.totalIntervalsGlobal ?? 0,
      setNumber: current?.setNumber ?? 0,
      totalSets: current?.totalSets ?? 0,
    };
  }

  private makeIdleState(sequence: FlatInterval[]): EngineState {
    const first = sequence[0];
    const total = sequence.reduce((s, i) => s + i.durationSeconds, 0);
    return {
      status: 'idle',
      sequence,
      currentIndex: 0,
      // Enforce minimum 1 centisecond to prevent infinite loop on 0-second intervals
      ticksRemaining: first ? Math.max(1, first.durationSeconds * 100) : 0,
      elapsedTotalSeconds: 0,
      totalDurationSeconds: total,
    };
  }

  private stop(): void {
    this.worker.postMessage({ cmd: 'stop' });
    this.stopRaf();
    this.state.status = 'idle';
  }
}
