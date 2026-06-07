import { v4 as uuidv4 } from 'uuid';
import { colorForIndex } from '../engine/colorPalette';
import { parseSecondsProFile } from './secondsProParser';
import type { AudioSettings, Circuit, CompoundTimer, Exercise } from '../types/timer';

function nonNegInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

/** Our own `.timer` shape: an object with a name and a circuits array. */
function isNativeShape(o: unknown): boolean {
  return isRecord(o) && typeof o.name === 'string' && Array.isArray(o.circuits);
}

/** Seconds / Seconds Pro export (.seconds file or intervaltimer.com): an object with
 *  an intervals list or sub-timers. `type` may be a number or a numeric string. */
function isSecondsProShape(o: unknown): boolean {
  return isRecord(o) && (Array.isArray(o.intervals) || Array.isArray(o.timers));
}

function parseAudioSettings(raw: unknown): AudioSettings | undefined {
  if (!isRecord(raw)) return undefined;
  const presets = ['classic', 'soft', 'sharp', 'bell'];
  const preset = typeof raw.preset === 'string' && presets.includes(raw.preset) ? raw.preset : 'classic';
  return {
    preset: preset as AudioSettings['preset'],
    countdownEnabled: raw.countdownEnabled !== false,
  };
}

/** Validate + normalize a native `.timer` object, regenerating every id so repeated
 *  imports never collide on circuit/exercise ids (which React uses as keys). */
function hardenNative(raw: Record<string, unknown>): CompoundTimer {
  const name = (raw.name as string).trim() || 'Untitled Timer';
  const circuitsRaw = raw.circuits as unknown[];
  if (circuitsRaw.length === 0) {
    throw new Error('has no circuits.');
  }

  const circuits: Circuit[] = circuitsRaw.map((c, ci) => {
    if (!isRecord(c)) throw new Error(`circuit ${ci + 1} is not valid.`);
    const exercisesRaw = Array.isArray(c.exercises) ? c.exercises : [];
    if (exercisesRaw.length === 0) {
      throw new Error(`circuit "${(c.name as string) || ci + 1}" has no exercises.`);
    }
    const exercises: Exercise[] = exercisesRaw.map((e, ei) => {
      if (!isRecord(e)) throw new Error(`an exercise in circuit ${ci + 1} is not valid.`);
      const duration = Number(e.durationSeconds);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(`exercise "${(e.name as string) || ei + 1}" has an invalid duration.`);
      }
      const color = typeof e.color === 'string' && e.color.trim() ? e.color.trim() : colorForIndex(ei);
      const repCount = Number(e.repCount);
      return {
        id: uuidv4(),
        name: typeof e.name === 'string' ? e.name : '',
        durationSeconds: Math.round(duration),
        repCount: Number.isFinite(repCount) && repCount > 0 ? Math.round(repCount) : undefined,
        color,
      };
    });
    return {
      id: uuidv4(),
      name: typeof c.name === 'string' ? c.name : `Circuit ${ci + 1}`,
      exercises,
      sets: positiveInt(c.sets, 1),
      restBetweenExercisesSeconds: nonNegInt(c.restBetweenExercisesSeconds, 0),
      restBetweenCircuitsSeconds: nonNegInt(c.restBetweenCircuitsSeconds, 0),
    };
  });

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    circuits,
    audioSettings: parseAudioSettings(raw.audioSettings),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse one imported file's text into a CompoundTimer, auto-detecting the format
 * (native `.timer` JSON or a Seconds Pro export). Throws a clear, user-facing error.
 */
export function parseImport(text: string): CompoundTimer {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('is not valid JSON.');
  }

  // Native first — it is this app's own format, so it wins any ambiguity.
  if (isNativeShape(raw)) {
    return hardenNative(raw as Record<string, unknown>);
  }
  if (isSecondsProShape(raw)) {
    return parseSecondsProFile(text);
  }
  throw new Error('is not a recognized timer file (expected a .timer export or a Seconds Pro file).');
}
