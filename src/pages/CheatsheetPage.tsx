import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Columns2, Rows3 } from 'lucide-react';
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
  return singleSetTime * circuit.sets;
}

export function CheatsheetPage() {
  const { timerId } = useParams();
  const navigate = useNavigate();
  const storage = useStorage();
  const [timer, setTimer] = useState<CompoundTimer | null>(null);
  const [twoColumn, setTwoColumn] = useState(true);

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
          onClick={() => setTwoColumn(!twoColumn)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            twoColumn
              ? 'bg-brand/10 text-brand'
              : 'text-brand-navy/60 hover:text-brand-navy hover:bg-gray-100'
          }`}
        >
          {twoColumn ? <Rows3 size={16} /> : <Columns2 size={16} />}
          {twoColumn ? '1 Column' : '2 Columns'}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors"
        >
          <Printer size={16} />
          Print
        </button>
      </div>

      {/* Print orientation style */}
      {twoColumn && (
        <style>{`@media print { @page { size: landscape; margin: 0.4in; } }`}</style>
      )}

      {/* Printable content */}
      <div className={`mx-auto px-8 py-10 print:px-0 print:py-2 ${twoColumn ? 'max-w-5xl print:max-w-none' : 'max-w-2xl print:max-w-none'}`}>
        {/* Header */}
        <h1 className={`font-extrabold text-brand-navy mb-1 ${twoColumn ? 'text-2xl print:text-xl' : 'text-4xl print:text-3xl'}`}>
          {timer.name || 'Untitled Timer'}
        </h1>
        <p className={`text-brand-navy/50 ${twoColumn ? 'text-base mb-4 print:mb-3 print:text-sm' : 'text-xl mb-8 print:mb-6 print:text-lg'}`}>
          {formatDuration(totalSeconds)} total
          {' \u00b7 '}
          {timer.circuits.length} circuit{timer.circuits.length !== 1 ? 's' : ''}
        </p>

        {/* Circuits */}
        <div className={twoColumn ? 'columns-2 gap-6 print:gap-4' : 'space-y-8 print:space-y-6'}>
          {timer.circuits.map((circuit, ci) => {
            const duration = circuitDuration(circuit);
            return (
              <div key={circuit.id} className={`break-inside-avoid ${twoColumn ? 'mb-4 print:mb-3' : ''}`}>
                {/* Circuit header with summary on same line */}
                <div className={`flex items-baseline gap-2 border-b-2 border-brand-navy/10 flex-wrap ${twoColumn ? 'mb-1 pb-1 gap-1.5' : 'mb-2 pb-2 gap-3'}`}>
                  <span className={`font-bold text-white bg-brand-navy rounded-full flex items-center justify-center flex-shrink-0 ${twoColumn ? 'text-sm w-6 h-6 print:text-xs print:w-5 print:h-5' : 'text-lg w-8 h-8 print:text-base print:w-7 print:h-7'}`}>
                    {ci + 1}
                  </span>
                  <h2 className={`font-bold text-brand-navy ${twoColumn ? 'text-lg print:text-base' : 'text-2xl print:text-xl'}`}>
                    {circuit.name}
                  </h2>
                  <span className={`text-brand-navy/40 ${twoColumn ? 'text-xs print:text-[11px]' : 'text-base print:text-sm'}`}>
                    {circuit.sets} set{circuit.sets !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {circuit.exercises.length} exercise{circuit.exercises.length !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {circuit.exercises[0]?.durationSeconds ?? 0}s work
                    {circuit.restBetweenExercisesSeconds > 0 &&
                      ` / ${circuit.restBetweenExercisesSeconds}s rest`}
                    {circuit.restBetweenCircuitsSeconds > 0 &&
                      ` / ${circuit.restBetweenCircuitsSeconds}s after circuit`}
                  </span>
                  <span className={`text-brand-navy/40 font-mono ml-auto ${twoColumn ? 'text-xs print:text-[11px]' : 'text-base print:text-sm'}`}>
                    {formatDuration(duration)}
                  </span>
                </div>

                {/* Exercise list */}
                <div className="grid grid-cols-1 gap-0.5">
                  {circuit.exercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className={`flex items-center rounded-lg ${twoColumn ? 'gap-2 py-0.5 px-1' : 'gap-3 py-1.5 px-2'}`}
                    >
                      <div
                        className={`rounded-full flex-shrink-0 ${twoColumn ? 'w-3 h-3 print:w-2.5 print:h-2.5' : 'w-4 h-4 print:w-3 print:h-3'}`}
                        style={{ backgroundColor: exercise.color }}
                      />
                      <span className={`font-semibold text-brand-navy flex-1 ${twoColumn ? 'text-base print:text-sm' : 'text-xl print:text-lg'}`}>
                        {exercise.name || 'Unnamed'}
                      </span>
                      <span className={`font-mono text-brand-navy/50 ${twoColumn ? 'text-sm print:text-xs' : 'text-lg print:text-base'}`}>
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
