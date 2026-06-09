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
  const presets = ['classic', 'soft', 'sharp', 'bell', 'strong', 'horn', 'whistle', 'gong'];
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
    // Preserve timer-level settings when present; omitted fields fall back to defaults.
    warmupSeconds: typeof raw.warmupSeconds === 'number' ? nonNegInt(raw.warmupSeconds, 0) : undefined,
    autoRest: typeof raw.autoRest === 'boolean' ? raw.autoRest : undefined,
    targetDurationSeconds:
      typeof raw.targetDurationSeconds === 'number' && raw.targetDurationSeconds > 0
        ? Math.round(raw.targetDurationSeconds)
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export interface ParsedImport {
  timer: CompoundTimer;
  warnings: string[];
}

/** One entry of a multi-timer file that failed to parse; the others still import. */
export interface FailedImport {
  /** Best-effort name from the raw entry, for its row in the import results. */
  name: string;
  error: string;
}

export type ImportEntry = ParsedImport | FailedImport;

export function isFailedImport(entry: ImportEntry): entry is FailedImport {
  return 'error' in entry;
}

function parseEntry(raw: unknown): ParsedImport {
  // Native first — it is this app's own format, so it wins any ambiguity.
  if (isNativeShape(raw)) {
    return { timer: hardenNative(raw as Record<string, unknown>), warnings: [] };
  }
  if (isSecondsProShape(raw)) {
    return parseSecondsProFile(JSON.stringify(raw));
  }
  throw new Error('is not a recognized timer file (expected a .timer export, or a Seconds / Seconds Pro / intervaltimer file).');
}

/**
 * Parse one imported file's text into every timer it contains, auto-detecting
 * the format of each entry (native `.timer` JSON or a Seconds Pro export).
 * Each result carries that timer's import-approximation warnings (empty when
 * the conversion was exact). In a multi-timer file a bad entry becomes a
 * FailedImport while the rest still parse. Throws a clear, user-facing error
 * only for whole-file problems (invalid JSON, nothing recognizable).
 */
export function parseImportAll(text: string): ImportEntry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('is not valid JSON.');
  }

  // Some exports wrap one or more timers in an array — import every usable one,
  // isolating each entry's failure so one bad timer can't sink the whole file.
  if (Array.isArray(raw)) {
    const usable = raw.filter((x) => isNativeShape(x) || isSecondsProShape(x));
    if (usable.length === 0) {
      throw new Error('contains no recognizable timers (expected .timer exports, or Seconds / Seconds Pro / intervaltimer timers).');
    }
    return usable.map((entry, i): ImportEntry => {
      try {
        return parseEntry(entry);
      } catch (err) {
        const name =
          (isRecord(entry) && typeof entry.name === 'string' && entry.name.trim()) || `Timer ${i + 1}`;
        return { name, error: err instanceof Error ? err.message : 'could not be read.' };
      }
    });
  }
  return [parseEntry(raw)];
}

/** First timer only — kept for callers that take a single timer per file. */
export function parseImport(text: string): CompoundTimer {
  const entries = parseImportAll(text);
  for (const entry of entries) {
    if (!isFailedImport(entry)) return entry.timer;
  }
  throw new Error((entries[0] as FailedImport).error);
}
