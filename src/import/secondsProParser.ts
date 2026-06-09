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

export interface ParsedSecondsTimer {
  timer: CompoundTimer;
  warnings: string[];
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

function restSeconds(interval: SecondsInterval | undefined): number {
  const n = Number(interval?.duration);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

const REST_NAME_PATTERN = /\b(?:rest|recover|recovery|break)\b/i;

/** Trust the explicit rest flag when present. Otherwise only a whole-word name
 *  match counts — substrings ("Wrestler twists") and color alone must never
 *  reclassify a real exercise as rest. */
function isRestInterval(interval: SecondsInterval): boolean {
  if (typeof interval.rest === 'boolean') return interval.rest;
  const name = typeof interval.name === 'string' ? interval.name.trim() : '';
  return REST_NAME_PATTERN.test(name);
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

function restStep(durationSeconds: number): Exercise {
  return { id: uuidv4(), name: 'Rest', durationSeconds, color: REST_COLOR };
}

/** Map Seconds' between-set rest onto the model. A single-exercise circuit with no
 *  in-set rest maps exactly onto restBetweenExercisesSeconds. Otherwise the model's
 *  between-exercise rest would bridge set boundaries where the set rest belongs, so
 *  the in-set rests are materialized as explicit 'Rest' steps (after the last
 *  exercise too when the source pattern had a trailing rest) and the set rest
 *  becomes a trailing step — duration-faithful per set, but it also plays after the
 *  final set, which is warned. */
function applySetRest(
  circuit: Circuit,
  setRest: number,
  timerName: string,
  warnings: string[],
  inlineRestAfterLast = false,
): void {
  if (setRest <= 0 || circuit.sets <= 1) return;
  const inlineRest = circuit.restBetweenExercisesSeconds;
  if (circuit.exercises.length === 1 && (inlineRest === 0 || !inlineRestAfterLast)) {
    // Exact: with one exercise per set nothing plays between exercises, so the
    // between-exercise slot is free to carry the set rest.
    circuit.restBetweenExercisesSeconds = setRest;
    return;
  }
  if (inlineRest > 0) {
    const woven: Exercise[] = [];
    circuit.exercises.forEach((e, i) => {
      woven.push(e);
      if (i < circuit.exercises.length - 1 || inlineRestAfterLast) woven.push(restStep(inlineRest));
    });
    circuit.exercises = woven;
    circuit.restBetweenExercisesSeconds = 0;
  }
  circuit.exercises.push(restStep(setRest));
  warnings.push(
    `Set rest in "${timerName}" was kept as a trailing 'Rest' step in each set; it will also play after the final set.`,
  );
}

function parseType3(file: SecondsProFile, warnings: string[]): Circuit[] {
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

  const main = buildCircuit(file.name, exercises, sets, restSeconds(file.intervalRest), 0);
  applySetRest(main, restSeconds(file.setRest), file.name, warnings);
  circuits.push(main);

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

function parseType0(file: SecondsProFile, warnings: string[]): Circuit[] {
  const sets = parseSetCount(file.numberOfSets);

  const restFlags = file.intervals.map(isRestInterval);
  const rests = file.intervals.filter((_, i) => restFlags[i]);

  if (rests.length === file.intervals.length) {
    throw new Error(
      `"${file.name}": all intervals are rests — no exercises found to import.`,
    );
  }

  // Lossless only when the same-length rest alternates after every exercise
  // (trailing rest optional); anything else must keep its pacing in place.
  const uniformRest = restSeconds(rests[0]);
  const uniform =
    rests.length === 0 ||
    (restFlags.every((isRest, i) => isRest === (i % 2 === 1)) &&
      rests.every(r => restSeconds(r) === uniformRest));

  let circuit: Circuit;
  let trailingRest = false;
  if (uniform) {
    const exercises: Exercise[] = file.intervals
      .filter((_, i) => !restFlags[i])
      .map(interval => toExercise(interval, false));
    circuit = buildCircuit(file.name, exercises, sets, uniformRest, 0);
    // Whether the source pattern ended each round with a rest — applySetRest must
    // keep that rest in place when it materializes the steps.
    trailingRest = restFlags.length > 0 && restFlags[restFlags.length - 1];
  } else {
    const exercises: Exercise[] = file.intervals.map((interval, i) =>
      toExercise(interval, restFlags[i]),
    );
    circuit = buildCircuit(file.name, exercises, sets, 0, 0);
    warnings.push(
      `Rest intervals in "${file.name}" were kept in place as 'Rest' steps — check the timeline.`,
    );
  }

  applySetRest(circuit, restSeconds(file.setRest), file.name, warnings, trailingRest);
  return [circuit];
}

function parseType4(file: SecondsProFile, warnings: string[]): Circuit[] {
  if (!Array.isArray(file.timers) || file.timers.length === 0) {
    throw new Error(`"${file.name}": compound timer contains no sub-timers.`);
  }

  const circuits: Circuit[] = [];
  const timerRest = restSeconds(file.timerRest);

  if (hasDuration(file.warmup)) {
    circuits.push(buildCircuit('Warmup', [toExercise(file.warmup, false)], 1, 0, 0));
  }

  file.timers.forEach((subTimer, index) => {
    if (typeof subTimer.name !== 'string' || !subTimer.name.trim()) {
      subTimer.name = `Circuit ${index + 1}`;
    }
    if (!Array.isArray(subTimer.intervals) || subTimer.intervals.length === 0) {
      throw new Error(`"${file.name}": sub-timer "${subTimer.name}" has no intervals.`);
    }
    const subCircuits = parseType3(subTimer, warnings);
    // timerRest is the file's spacing between sub-timers; it follows each
    // sub-timer's last circuit.
    subCircuits[subCircuits.length - 1].restBetweenCircuitsSeconds = timerRest;
    circuits.push(...subCircuits);
  });

  if (hasDuration(file.cooldown)) {
    circuits.push(buildCircuit('Cooldown', [toExercise(file.cooldown, false)], 1, 0, 0));
  }

  return circuits;
}

function parseCircuits(file: SecondsProFile, warnings: string[]): Circuit[] {
  const hasIntervals = Array.isArray(file.intervals) && file.intervals.length > 0;
  const hasTimers = Array.isArray(file.timers) && file.timers.length > 0;

  if (file.type === 4 || (hasTimers && !hasIntervals)) {
    return parseType4(file, warnings);
  }

  if (!hasIntervals) {
    throw new Error(`"${file.name}": file has no intervals or sub-timers to import.`);
  }

  if (file.type === 3) {
    return parseType3(file, warnings);
  }
  // type 0 and any other interval-based type — treat rests inline (best effort).
  return parseType0(file, warnings);
}

export function parseSecondsProFile(jsonText: string): ParsedSecondsTimer {
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

  const warnings: string[] = [];
  const circuits = parseCircuits(file, warnings);
  const now = new Date().toISOString();

  return {
    timer: {
      id: uuidv4(),
      name: file.name,
      circuits,
      // Seconds files express their warm-up explicitly (converted to a Warmup
      // circuit above); never inherit the app's 10-minute default.
      warmupSeconds: 0,
      createdAt: now,
      updatedAt: now,
    },
    warnings,
  };
}
