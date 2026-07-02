import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { CompoundTimer, Circuit } from '../../types/timer';
import { computeAutoRest, computeTotalDuration, formatRest, DEFAULT_TARGET_SECONDS } from '../../engine/sequenceBuilder';

type CopyTimerDialogProps = {
  timer: CompoundTimer;
  onCancel: () => void;
} & (
  /** 'new' — create a separate timer from the selection (shows a name field). */
  | { mode: 'new'; onConfirm: (copy: CompoundTimer) => void }
  /** 'append' — hand back the selection to add to the end of this timer. */
  | { mode: 'append'; onConfirm: (circuits: Circuit[]) => void }
);

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Selection is keyed by position, not by circuit/exercise id — imported or
// Drive-pulled JSON is never validated, so ids are not guaranteed unique.
const circuitKey = (ci: number) => `c${ci}`;
const exerciseKey = (ci: number, ei: number) => `c${ci}:e${ei}`;

function allSelectableKeys(timer: CompoundTimer): Set<string> {
  const keys = new Set<string>();
  timer.circuits.forEach((c, ci) => {
    // A circuit with no exercises has nothing beneath it to select, so it gets
    // its own entry; otherwise its state is derived from its exercises.
    if (c.exercises.length === 0) keys.add(circuitKey(ci));
    c.exercises.forEach((_, ei) => keys.add(exerciseKey(ci, ei)));
  });
  return keys;
}

/** Strip a timer down to the selected circuits/exercises, keeping timer-level settings. */
function selectCircuits(timer: CompoundTimer, selected: Set<string>): Circuit[] {
  return timer.circuits
    .map((circuit, ci) => ({ circuit, ci }))
    .filter(({ circuit, ci }) =>
      circuit.exercises.length === 0
        ? selected.has(circuitKey(ci))
        : circuit.exercises.some((_, ei) => selected.has(exerciseKey(ci, ei)))
    )
    .map(({ circuit, ci }) => ({
      ...circuit,
      exercises: circuit.exercises.filter((_, ei) => selected.has(exerciseKey(ci, ei))),
    }));
}

export function CopyTimerDialog(props: CopyTimerDialogProps) {
  const { timer, onCancel } = props;
  const isAppend = props.mode === 'append';
  const defaultName = `${timer.name || 'Untitled Timer'} (copy)`;
  const [name, setName] = useState(defaultName);
  const [selected, setSelected] = useState<Set<string>>(() => allSelectableKeys(timer));
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropMouseDown = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // A real modal: focus starts inside (on the panel, so no keyboard pops up on
  // tablets) and Tab cycles within it — the library behind stays unreachable.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>('button, input');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const toggle = (keys: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  // What the copy will contain, live — drives the summary line and the confirm button.
  const previewCircuits = useMemo(() => selectCircuits(timer, selected), [timer, selected]);
  const selectedExerciseCount = previewCircuits.reduce((s, c) => s + c.exercises.length, 0);
  const totalExerciseCount = timer.circuits.reduce((s, c) => s + c.exercises.length, 0);
  // 'new' mode: the copy's own circuits. 'append' mode: what this workout
  // becomes once the selection is added to its end.
  const resultCircuits = useMemo(
    () => (isAppend ? [...timer.circuits, ...previewCircuits] : previewCircuits),
    [timer, previewCircuits, isAppend]
  );
  const copyDurationSeconds = useMemo(
    () => computeTotalDuration({ ...timer, circuits: resultCircuits }),
    [timer, resultCircuits]
  );
  // With auto-rest on, the total is pinned to the class length — the number that
  // really moves as she selects is the rest between circuits. Show it.
  const resultAutoRest =
    timer.autoRest && resultCircuits.length > 1 ? computeAutoRest({ ...timer, circuits: resultCircuits }) : null;
  const nothingToCopy = timer.circuits.length === 0;
  const nothingSelected = previewCircuits.length === 0;
  const everythingSelected = selected.size === allSelectableKeys(timer).size;
  // A stray tap outside only dismisses an untouched dialog; once she has renamed
  // or pruned anything, closing takes an explicit Cancel/X/Escape.
  const pristine = everythingSelected && name === defaultName;

  const handleConfirm = () => {
    if (nothingSelected) return;
    const circuits = previewCircuits.map((c) => ({
      ...c,
      id: uuidv4(),
      exercises: c.exercises.map((e) => ({ ...e, id: uuidv4() })),
    }));
    if (props.mode === 'append') {
      props.onConfirm(circuits);
      return;
    }
    // Timer-level fields are picked explicitly so device-local metadata a library
    // row carries (origin, dirty) never leaks into the saved copy.
    props.onConfirm({
      id: uuidv4(),
      name: name.trim() || defaultName,
      circuits,
      audioSettings: timer.audioSettings,
      warmupSeconds: timer.warmupSeconds,
      autoRest: timer.autoRest,
      targetDurationSeconds: timer.targetDurationSeconds,
      createdAt: '',
      updatedAt: '',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        backdropMouseDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Close only on a click that started AND ended on the backdrop — releasing a
        // text-selection drag outside the panel must not throw the selection away.
        if (backdropMouseDown.current && e.target === e.currentTarget && pristine) onCancel();
        backdropMouseDown.current = false;
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-workout-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[85vh] focus:outline-none"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 id="copy-workout-title" className="text-lg font-bold text-brand-navy">
            {isAppend ? 'Copy part of this workout' : 'Copy workout'}
          </h3>
          <button onClick={onCancel} className="p-2 -m-1 text-gray-400 hover:text-gray-600" title="Cancel">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-brand-navy/50 mb-4">
          {isAppend
            ? 'The checked items are copied to the end of this workout. Uncheck anything you don’t want repeated.'
            : 'Everything is included. Uncheck anything you don’t want in the copy.'}
        </p>

        {!isAppend && (
          <>
            <label className="block text-xs font-semibold uppercase tracking-wide text-brand-navy/50 mb-1.5">
              Name of the copy
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand/40 mb-4"
            />
          </>
        )}

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-navy/50">What to copy</span>
          {!nothingToCopy && (
            <button
              onClick={() => toggle([...allSelectableKeys(timer)], !everythingSelected)}
              className="text-xs font-semibold text-brand hover:text-brand-dark px-2 py-1 -my-1 -mr-2"
            >
              {everythingSelected ? 'Unselect all' : 'Select all'}
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
          {nothingToCopy && (
            <p className="px-4 py-8 text-sm text-brand-navy/40 text-center">
              This workout has no circuits yet, so there&rsquo;s nothing to copy.
            </p>
          )}
          {timer.circuits.map((circuit, ci) => {
            const isEmpty = circuit.exercises.length === 0;
            const selCount = circuit.exercises.filter((_, ei) => selected.has(exerciseKey(ci, ei))).length;
            const allOn = isEmpty ? selected.has(circuitKey(ci)) : selCount === circuit.exercises.length;
            const partial = !isEmpty && selCount > 0 && selCount < circuit.exercises.length;
            const circuitKeys = isEmpty ? [circuitKey(ci)] : circuit.exercises.map((_, ei) => exerciseKey(ci, ei));
            return (
              <div key={circuitKey(ci)}>
                <label className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-gray-50 select-none">
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = partial;
                    }}
                    onChange={(e) => toggle(circuitKeys, e.target.checked)}
                    className="w-5 h-5 accent-brand rounded shrink-0"
                  />
                  <span className="font-semibold text-sm text-brand-navy flex-1 truncate">
                    {circuit.name.trim() || `Circuit ${ci + 1}`}
                  </span>
                  <span className="text-xs text-brand-navy/40 font-medium shrink-0">
                    {circuit.exercises.length} exercise{circuit.exercises.length !== 1 ? 's' : ''} &middot; {circuit.sets} set{circuit.sets !== 1 ? 's' : ''}
                  </span>
                </label>
                {circuit.exercises.map((exercise, ei) => (
                  <label
                    key={exerciseKey(ci, ei)}
                    className="flex items-center gap-3 pl-10 pr-3 py-2.5 cursor-pointer hover:bg-gray-50 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(exerciseKey(ci, ei))}
                      onChange={(e) => toggle([exerciseKey(ci, ei)], e.target.checked)}
                      className="w-5 h-5 accent-brand rounded shrink-0"
                    />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: exercise.color }} />
                    <span className="text-sm text-brand-navy/80 flex-1 truncate">
                      {exercise.name.trim() || <span className="text-brand-navy/35">Exercise {ei + 1}</span>}
                    </span>
                    <span className="text-xs text-brand-navy/40 font-mono shrink-0">
                      {exercise.repCount ? `${exercise.repCount} reps` : formatDuration(exercise.durationSeconds)}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <p className="text-sm text-brand-navy/60 mt-3">
          {nothingSelected ? (
            nothingToCopy ? 'There is nothing to copy from this workout.' : 'Nothing selected yet — check at least one exercise.'
          ) : (
            <>
              {isAppend ? 'Adding' : 'Copying'} <span className="font-semibold">{previewCircuits.length} of {timer.circuits.length}</span> circuit{timer.circuits.length !== 1 ? 's' : ''},{' '}
              <span className="font-semibold">{selectedExerciseCount} of {totalExerciseCount}</span> exercise{totalExerciseCount !== 1 ? 's' : ''} &middot;{' '}
              {isAppend ? 'workout becomes' : ''} <span className="font-mono font-semibold">{formatDuration(copyDurationSeconds)}</span>{isAppend ? '' : ' total'}
            </>
          )}
        </p>
        {timer.autoRest && !nothingSelected && (
          <p className="text-xs text-brand-navy/40 mt-1">
            Rest between circuits auto-adjusts to fill the {Math.round((timer.targetDurationSeconds ?? DEFAULT_TARGET_SECONDS) / 60)}-minute class length
            {resultAutoRest !== null ? <> — it becomes <span className="font-semibold">{formatRest(resultAutoRest)}</span></> : null}.
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-brand-navy/60 hover:text-brand-navy">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={nothingSelected}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-40"
          >
            <Copy size={15} /> {isAppend ? 'Add to end' : 'Create copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
