import { useEffect, useRef, useState, useCallback } from 'react';
import { TimerEngine } from '../engine/TimerEngine';
import type { EngineSnapshot } from '../types/engine';
import type { CompoundTimer } from '../types/timer';
import { buildSequence } from '../engine/sequenceBuilder';

const NULL_SNAPSHOT: EngineSnapshot = {
  status: 'idle',
  current: null,
  next: null,
  secondsRemaining: 0,
  elapsedTotalSeconds: 0,
  totalDurationSeconds: 0,
  intervalIndex: 0,
  totalIntervals: 0,
  setNumber: 0,
  totalSets: 0,
};

export function useTimerEngine(timer: CompoundTimer | null) {
  const engineRef = useRef<TimerEngine | null>(null);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(NULL_SNAPSHOT);

  // Create engine and subscribe in one effect to avoid ordering issues
  useEffect(() => {
    const engine = new TimerEngine();
    engineRef.current = engine;
    const unsubscribe = engine.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Load timer sequence when timer changes
  useEffect(() => {
    if (!engineRef.current || !timer) return;
    const sequence = buildSequence(timer);
    engineRef.current.load(sequence);
  }, [timer]);

  const play = useCallback(() => engineRef.current?.play(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const reset = useCallback(() => engineRef.current?.reset(), []);
  const skipForward = useCallback(() => engineRef.current?.skipForward(), []);
  const skipBack = useCallback(() => engineRef.current?.skipBack(), []);

  return { snapshot, play, pause, reset, skipForward, skipBack };
}
