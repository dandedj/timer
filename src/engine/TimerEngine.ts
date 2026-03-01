import type { FlatInterval } from '../types/timer';
import type { EngineState, EngineSnapshot } from '../types/engine';
import { AudioEngine } from './audioEngine';

type StateListener = (snapshot: EngineSnapshot) => void;

export class TimerEngine {
  private worker: Worker;
  private audio: AudioEngine;
  private state: EngineState;
  private listeners: Set<StateListener> = new Set();
  private rafHandle: number | null = null;
  private lastWorkerTickMs: number = 0;
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

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.buildSnapshot());
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.stop();
    this.worker.terminate();
  }

  private handleWorkerTick(): void {
    if (this.state.status !== 'running') return;

    const now = performance.now();
    // On first tick after play/resume, initialize timing baseline
    if (this.lastWorkerTickMs === 0) {
      this.lastWorkerTickMs = now;
      return;
    }
    const elapsed = now - this.lastWorkerTickMs;
    this.lastWorkerTickMs = now;
    this.accumulatedMs += elapsed;

    const centisecondsElapsed = Math.floor(this.accumulatedMs / 10);
    this.accumulatedMs -= centisecondsElapsed * 10;

    this.advance(centisecondsElapsed);
  }

  private advance(centiseconds: number): void {
    let remaining = centiseconds;

    while (remaining > 0 && this.state.status === 'running') {
      if (this.state.ticksRemaining <= remaining) {
        remaining -= this.state.ticksRemaining;
        this.state.elapsedTotalSeconds += this.state.ticksRemaining / 100;
        this.state.ticksRemaining = 0;
        this.onIntervalComplete();
      } else {
        this.state.elapsedTotalSeconds += remaining / 100;
        this.state.ticksRemaining -= remaining;
        remaining = 0;
      }
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

    const isRest = next.kind !== 'work';
    this.audio.playTransition(isRest);
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
