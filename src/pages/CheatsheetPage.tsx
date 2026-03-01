import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useStorage } from '../storage/storageContext';
import type { CompoundTimer, Circuit } from '../types/timer';
import { buildSequence } from '../engine/sequenceBuilder';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}:00`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function circuitDuration(circuit: Circuit): number {
  const exerciseTime = circuit.exercises.reduce((s, e) => s + e.durationSeconds, 0);
  const restsBetweenExercises =
    Math.max(0, circuit.exercises.length - 1) * circuit.restBetweenExercisesSeconds;
  const singleSetTime = exerciseTime + restsBetweenExercises;
  const restsBetweenSets =
    Math.max(0, circuit.sets - 1) * circuit.restBetweenSetsSeconds;
  return singleSetTime * circuit.sets + restsBetweenSets;
}

export function CheatsheetPage() {
  const { timerId } = useParams();
  const navigate = useNavigate();
  const storage = useStorage();
  const [timer, setTimer] = useState<CompoundTimer | null>(null);

  useEffect(() => {
    if (!timerId) {
      navigate('/library');
      return;
    }
    storage.getTimer(timerId).then((t) => {
      if (t) setTimer(t);
      else navigate('/library');
    });
  }, [timerId, storage, navigate]);

  if (!timer) return null;

  const sequence = buildSequence(timer);
  const totalSeconds = sequence.reduce((s, i) => s + i.durationSeconds, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Screen-only toolbar */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-brand-navy/60 hover:text-brand-navy transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors"
        >
          <Printer size={16} />
          Print
        </button>
      </div>

      {/* Printable content */}
      <div className="max-w-2xl mx-auto px-8 py-10 print:px-0 print:py-4 print:max-w-none">
        {/* Header */}
        <h1 className="text-4xl font-extrabold text-brand-navy mb-1 print:text-3xl">
          {timer.name || 'Untitled Timer'}
        </h1>
        <p className="text-xl text-brand-navy/50 mb-8 print:mb-6 print:text-lg">
          {formatDuration(totalSeconds)} total
          {' \u00b7 '}
          {timer.circuits.length} circuit{timer.circuits.length !== 1 ? 's' : ''}
        </p>

        {/* Circuits */}
        <div className="space-y-8 print:space-y-6">
          {timer.circuits.map((circuit, ci) => {
            const duration = circuitDuration(circuit);
            return (
              <div key={circuit.id} className="break-inside-avoid">
                {/* Circuit header */}
                <div className="flex items-baseline gap-3 mb-3 border-b-2 border-brand-navy/10 pb-2">
                  <span className="text-lg font-bold text-white bg-brand-navy rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 print:text-base print:w-7 print:h-7">
                    {ci + 1}
                  </span>
                  <h2 className="text-2xl font-bold text-brand-navy print:text-xl">
                    {circuit.name}
                  </h2>
                  <span className="text-lg text-brand-navy/40 font-mono print:text-base">
                    {formatDuration(duration)}
                  </span>
                </div>

                {/* Circuit summary line */}
                <p className="text-lg text-brand-navy/60 mb-3 print:text-base">
                  {circuit.sets} set{circuit.sets !== 1 ? 's' : ''}
                  {' \u00b7 '}
                  {circuit.exercises.length} exercise{circuit.exercises.length !== 1 ? 's' : ''}
                  {' \u00b7 '}
                  {circuit.exercises[0]?.durationSeconds ?? 0}s work
                  {circuit.restBetweenExercisesSeconds > 0 &&
                    ` / ${circuit.restBetweenExercisesSeconds}s rest`}
                  {circuit.sets > 1 &&
                    circuit.restBetweenSetsSeconds > 0 &&
                    ` / ${circuit.restBetweenSetsSeconds}s between sets`}
                </p>

                {/* Exercise list */}
                <div className="grid grid-cols-1 gap-1">
                  {circuit.exercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className="flex items-center gap-3 py-1.5 px-2 rounded-lg"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 print:w-3 print:h-3"
                        style={{ backgroundColor: exercise.color }}
                      />
                      <span className="text-xl font-semibold text-brand-navy flex-1 print:text-lg">
                        {exercise.name || 'Unnamed'}
                      </span>
                      <span className="text-lg font-mono text-brand-navy/50 print:text-base">
                        {formatDuration(exercise.durationSeconds)}
                        {exercise.repCount ? ` \u00d7 ${exercise.repCount}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
