import type { CompoundTimer, FlatInterval, IntervalKind } from '../types/timer';
import { v4 as uuidv4 } from 'uuid';
import { REST_COLOR, REST_CIRCUIT_COLOR, WARMUP_COLOR } from './colorPalette';

/** Default lead-in warm-up (10 min) when a timer doesn't specify one. */
export const DEFAULT_WARMUP_SECONDS = 600;
/** Default target class length (45 min) used by auto-rest. */
export const DEFAULT_TARGET_SECONDS = 2700;

export function warmupSecondsFor(timer: CompoundTimer): number {
  return timer.warmupSeconds ?? DEFAULT_WARMUP_SECONDS;
}

/** Format a rest duration as a readable time: "15s", or "M:SS" for a minute or more. */
export function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

/** Number of rest-after-circuit gaps (a rest follows every circuit except the last). */
export function circuitRestGapCount(timer: CompoundTimer): number {
  return Math.max(0, timer.circuits.length - 1);
}

/** Everything except rest-between-circuits: warm-up + work + rest-between-exercises. */
export function fixedDurationSeconds(timer: CompoundTimer): number {
  let total = warmupSecondsFor(timer);
  for (const c of timer.circuits) {
    const workPerSet = c.exercises.reduce((s, e) => s + e.durationSeconds, 0);
    total += workPerSet * c.sets;
    const work = c.exercises.length * c.sets;
    const exerciseRestGaps = work > 1 ? work - 1 : 0;
    total += exerciseRestGaps * c.restBetweenExercisesSeconds;
  }
  return total;
}

/** The rest-between-circuits (seconds) that makes the total hit the target class length. */
export function computeAutoRest(timer: CompoundTimer): number {
  const gaps = circuitRestGapCount(timer);
  if (gaps <= 0) return 0;
  const target = timer.targetDurationSeconds ?? DEFAULT_TARGET_SECONDS;
  const r = Math.round((target - fixedDurationSeconds(timer)) / gaps);
  return Math.max(0, r);
}

export function buildSequence(timer: CompoundTimer): FlatInterval[] {
  const intervals: Omit<FlatInterval, 'intervalIndexGlobal' | 'totalIntervalsGlobal'>[] = [];

  // With auto-rest on, the stored per-circuit values may be stale — compute the truth here.
  const autoRestSeconds = timer.autoRest ? computeAutoRest(timer) : null;

  const warmupSeconds = warmupSecondsFor(timer);
  if (warmupSeconds > 0) {
    intervals.push({
      id: uuidv4(),
      kind: 'warmup' as IntervalKind,
      label: 'Warm Up',
      durationSeconds: warmupSeconds,
      color: WARMUP_COLOR,
      circuitName: 'Warm-up',
      circuitIndex: -1,
      setNumber: 1,
      totalSets: 1,
    });
  }

  for (let ci = 0; ci < timer.circuits.length; ci++) {
    const circuit = timer.circuits[ci];

    for (let setNum = 1; setNum <= circuit.sets; setNum++) {
      for (let ei = 0; ei < circuit.exercises.length; ei++) {
        const exercise = circuit.exercises[ei];

        intervals.push({
          id: uuidv4(),
          kind: 'work' as IntervalKind,
          label: exercise.name,
          durationSeconds: exercise.durationSeconds,
          color: exercise.color,
          repCount: exercise.repCount,
          circuitName: circuit.name,
          circuitIndex: ci,
          setNumber: setNum,
          totalSets: circuit.sets,
        });

        const isLastExercise = ei === circuit.exercises.length - 1;
        const isLastSet = setNum === circuit.sets;
        const isEndOfCircuit = isLastExercise && isLastSet;
        if (!isEndOfCircuit && circuit.restBetweenExercisesSeconds > 0) {
          intervals.push({
            id: uuidv4(),
            kind: 'rest-exercise' as IntervalKind,
            label: 'Rest',
            durationSeconds: circuit.restBetweenExercisesSeconds,
            color: REST_COLOR,
            circuitName: circuit.name,
            circuitIndex: ci,
            setNumber: setNum,
            totalSets: circuit.sets,
          });
        }
      }
    }

    // Rest between circuits (not after the last one)
    const isLastCircuit = ci === timer.circuits.length - 1;
    const circuitRestSeconds = autoRestSeconds ?? circuit.restBetweenCircuitsSeconds;
    if (!isLastCircuit && circuitRestSeconds > 0) {
      intervals.push({
        id: uuidv4(),
        kind: 'rest-circuit' as IntervalKind,
        label: 'Rest (between circuits)',
        durationSeconds: circuitRestSeconds,
        color: REST_CIRCUIT_COLOR,
        circuitName: circuit.name,
        circuitIndex: ci,
        setNumber: circuit.sets,
        totalSets: circuit.sets,
      });
    }
  }

  const total = intervals.length;
  return intervals.map((interval, i) => ({
    ...interval,
    intervalIndexGlobal: i + 1,
    totalIntervalsGlobal: total,
  }));
}

export function computeTotalDuration(timer: CompoundTimer): number {
  return buildSequence(timer).reduce((s, i) => s + i.durationSeconds, 0);
}
