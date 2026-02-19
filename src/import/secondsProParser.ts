import { v4 as uuidv4 } from 'uuid';
import { colorForIndex, REST_COLOR } from '../engine/colorPalette';
import type { Circuit, CompoundTimer, Exercise } from '../types/timer';

interface SecondsInterval {
  name: string;
  duration: number;
  color: number | string;
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
    : interval.color;
  return colorForIndex(Number.isFinite(colorNum) ? colorNum : 0);
}

function isRestInterval(interval: SecondsInterval): boolean {
  const colorNum = typeof interval.color === 'string'
    ? parseInt(interval.color, 10)
    : interval.color;
  return colorNum === 4 || interval.name.toLowerCase().includes('rest');
}

function toExercise(interval: SecondsInterval, isRest: boolean): Exercise {
  return {
    id: uuidv4(),
    name: interval.name,
    durationSeconds: interval.duration,
    color: intervalColor(interval, isRest),
  };
}

function buildCircuit(
  name: string,
  exercises: Exercise[],
  sets: number,
  restBetweenExercisesSeconds: number,
  restBetweenSetsSeconds: number,
): Circuit {
  return {
    id: uuidv4(),
    name,
    exercises,
    sets,
    restBetweenExercisesSeconds,
    restBetweenSetsSeconds,
  };
}

function parseType3(file: SecondsProFile): Circuit[] {
  const circuits: Circuit[] = [];
  const sets = parseSetCount(file.numberOfSets);

  if (file.warmup && file.warmup.duration > 0) {
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
  const restBetweenExercises = file.intervalRest?.duration ?? 0;
  const restBetweenSets = file.setRest?.duration ?? 0;

  circuits.push(buildCircuit(
    file.name,
    exercises,
    sets,
    restBetweenExercises,
    restBetweenSets,
  ));

  if (file.cooldown && file.cooldown.duration > 0) {
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

  const restBetweenExercises = rests.length > 0 ? rests[0].duration : 0;
  const exercises: Exercise[] = nonRests.map(interval =>
    toExercise(interval, false),
  );

  return [buildCircuit(file.name, exercises, sets, restBetweenExercises, 0)];
}

export function parseSecondsProFile(jsonText: string): CompoundTimer {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid Seconds Pro file: could not parse JSON.');
  }

  const file = raw as SecondsProFile;

  if (!file.name || typeof file.name !== 'string') {
    throw new Error('Invalid Seconds Pro file: missing timer name.');
  }

  if (!Array.isArray(file.intervals) || file.intervals.length === 0) {
    throw new Error(`"${file.name}": file contains no intervals.`);
  }

  let circuits: Circuit[];

  if (file.type === 3) {
    circuits = parseType3(file);
  } else if (file.type === 0) {
    circuits = parseType0(file);
  } else {
    throw new Error(
      `"${file.name}": unsupported Seconds Pro timer type ${file.type}. Only types 0 and 3 are supported.`,
    );
  }

  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name: file.name,
    circuits,
    createdAt: now,
    updatedAt: now,
  };
}
