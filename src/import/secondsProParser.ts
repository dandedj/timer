import { v4 as uuidv4 } from 'uuid';
import { colorForIndex, REST_COLOR } from '../engine/colorPalette';
import type { Circuit, CompoundTimer, Exercise } from '../types/timer';

interface SecondsInterval {
  name?: string;
  duration?: number;
  color?: number | string;
  rest?: boolean;
}

interface SecondsProFile {
  name: string;
  type: number;
  numberOfSets: number | string;
  intervals: SecondsInterval[];
  intervalRest?: SecondsInterval;
  setRest?: SecondsInterval;
  warmup?: SecondsInterval;
  cooldown?: SecondsInterval;
  timers?: SecondsProFile[];
  timerRest?: SecondsInterval;
}

function parseSetCount(value: number | string | undefined): number {
  if (value === undefined || value === null) return 1;
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function intervalColor(interval: SecondsInterval, isRest: boolean): string {
  if (isRest) return REST_COLOR;
  const colorNum = typeof interval.color === 'string'
    ? parseInt(interval.color, 10)
    : interval.color ?? 0;
  return colorForIndex(Number.isFinite(colorNum) ? colorNum : 0);
}

function hasDuration(interval: SecondsInterval | undefined): interval is SecondsInterval {
  return !!interval && Number(interval.duration) > 0;
}

function isRestInterval(interval: SecondsInterval): boolean {
  if (typeof interval.rest === 'boolean') return interval.rest;
  const colorNum = typeof interval.color === 'string'
    ? parseInt(interval.color, 10)
    : interval.color;
  const name = typeof interval.name === 'string' ? interval.name : '';
  return colorNum === 4 || name.toLowerCase().includes('rest');
}

function toExercise(interval: SecondsInterval, isRest: boolean): Exercise {
  const duration = Number(interval.duration);
  return {
    id: uuidv4(),
    name: typeof interval.name === 'string' ? interval.name : isRest ? 'Rest' : 'Exercise',
    durationSeconds: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0,
    color: intervalColor(interval, isRest),
  };
}

function buildCircuit(
  name: string,
  exercises: Exercise[],
  sets: number,
  restBetweenExercisesSeconds: number,
  restBetweenCircuitsSeconds: number,
): Circuit {
  return {
    id: uuidv4(),
    name,
    exercises,
    sets,
    restBetweenExercisesSeconds,
    restBetweenCircuitsSeconds,
  };
}

function parseType3(file: SecondsProFile): Circuit[] {
  const circuits: Circuit[] = [];
  const sets = parseSetCount(file.numberOfSets);

  if (hasDuration(file.warmup)) {
    circuits.push(buildCircuit(
      'Warmup',
      [toExercise(file.warmup, false)],
      1,
      0,
      0,
    ));
  }

  const exercises: Exercise[] = file.intervals.map(interval =>
    toExercise(interval, false),
  );
  const restBetweenExercises = Number(file.intervalRest?.duration) || 0;

  circuits.push(buildCircuit(
    file.name,
    exercises,
    sets,
    restBetweenExercises,
    15,
  ));

  if (hasDuration(file.cooldown)) {
    circuits.push(buildCircuit(
      'Cooldown',
      [toExercise(file.cooldown, false)],
      1,
      0,
      0,
    ));
  }

  return circuits;
}

function parseType0(file: SecondsProFile): Circuit[] {
  const sets = parseSetCount(file.numberOfSets);

  const rests = file.intervals.filter(isRestInterval);
  const nonRests = file.intervals.filter(i => !isRestInterval(i));

  if (nonRests.length === 0) {
    throw new Error(
      `"${file.name}": all intervals are rests — no exercises found to import.`,
    );
  }

  const restBetweenExercises = rests.length > 0 ? Number(rests[0].duration) || 0 : 0;
  const exercises: Exercise[] = nonRests.map(interval =>
    toExercise(interval, false),
  );

  return [buildCircuit(file.name, exercises, sets, restBetweenExercises, 0)];
}

function parseType4(file: SecondsProFile): Circuit[] {
  if (!Array.isArray(file.timers) || file.timers.length === 0) {
    throw new Error(`"${file.name}": compound timer contains no sub-timers.`);
  }

  const circuits: Circuit[] = [];

  if (hasDuration(file.warmup)) {
    circuits.push(buildCircuit('Warmup', [toExercise(file.warmup, false)], 1, 0, 0));
  }

  for (const subTimer of file.timers) {
    const subCircuits = parseType3(subTimer);
    circuits.push(...subCircuits);
  }

  if (hasDuration(file.cooldown)) {
    circuits.push(buildCircuit('Cooldown', [toExercise(file.cooldown, false)], 1, 0, 0));
  }

  return circuits;
}

function parseCircuits(file: SecondsProFile): Circuit[] {
  const hasIntervals = Array.isArray(file.intervals) && file.intervals.length > 0;
  const hasTimers = Array.isArray(file.timers) && file.timers.length > 0;

  if (file.type === 4 || (hasTimers && !hasIntervals)) {
    return parseType4(file);
  }

  if (!hasIntervals) {
    throw new Error(`"${file.name}": file has no intervals or sub-timers to import.`);
  }

  if (file.type === 3) {
    return parseType3(file);
  }
  // type 0 and any other interval-based type — treat rests inline (best effort).
  return parseType0(file);
}

export function parseSecondsProFile(jsonText: string): CompoundTimer {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid Seconds Pro file: could not parse JSON.');
  }

  const file = raw as SecondsProFile;

  if (typeof file.name !== 'string' || !file.name.trim()) {
    file.name = 'Imported timer';
  }

  // Normalize `type`: some exports stringify it; default by structure when absent.
  const rawType: unknown = file.type;
  const numType = typeof rawType === 'string' ? parseInt(rawType, 10) : rawType;
  file.type = Number.isFinite(numType as number)
    ? (numType as number)
    : Array.isArray(file.timers) ? 4 : 3;

  const circuits = parseCircuits(file);
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name: file.name,
    circuits,
    createdAt: now,
    updatedAt: now,
  };
}
