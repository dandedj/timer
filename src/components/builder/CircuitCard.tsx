import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Copy } from 'lucide-react';
import type { Circuit } from '../../types/timer';
import { ExerciseList } from './ExerciseList';
import { DurationPicker } from './DurationPicker';

interface CircuitCardProps {
  circuit: Circuit;
  colorOffset?: number;
  onChange: (circuit: Circuit) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function CircuitCard({ circuit, colorOffset = 0, onChange, onDelete, onDuplicate }: CircuitCardProps) {
  const [expanded, setExpanded] = useState(true);

  const totalDuration = circuit.exercises.reduce((sum, e) => {
    const exerciseTime = e.durationSeconds;
    return sum + exerciseTime;
  }, 0) * circuit.sets
    + Math.max(0, circuit.exercises.length - 1) * circuit.restBetweenExercisesSeconds * circuit.sets;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-4 overflow-hidden">
      <div className="flex">
        <div className="w-1.5 bg-gradient-to-b from-brand to-brand-dark flex-shrink-0" />
        <div className="flex-1">
          <div
            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-brand-navy/40">
              {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </span>

            <input
              type="text"
              value={circuit.name}
              onChange={(e) => {
                e.stopPropagation();
                onChange({ ...circuit, name: e.target.value });
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Circuit name"
              className="flex-1 px-2 py-1 border border-gray-200 rounded-lg font-semibold text-brand-navy bg-transparent focus:border-brand focus:outline-none"
            />

            <span className="text-xs text-brand-navy/40 font-medium">
              {circuit.exercises.length} exercises &middot; {circuit.sets} set{circuit.sets !== 1 ? 's' : ''} &middot; {formatDuration(totalDuration)}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="text-brand-navy/25 hover:text-brand transition-colors p-1"
              title="Duplicate circuit"
            >
              <Copy size={18} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-brand-navy/25 hover:text-red-500 transition-colors p-1"
              title="Delete circuit"
            >
              <Trash2 size={18} />
            </button>
          </div>

          {expanded && (
            <div className="px-4 pb-4 space-y-4">
              <div className="flex gap-6 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-brand-navy/50 font-medium">Sets:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={circuit.sets}
                    onChange={(e) => onChange({ ...circuit, sets: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm text-brand-navy font-medium focus:border-brand focus:outline-none"
                  />
                </div>

                <DurationPicker
                  label="Rest between exercises:"
                  value={circuit.restBetweenExercisesSeconds}
                  onChange={(s) => onChange({ ...circuit, restBetweenExercisesSeconds: s })}
                />

                <DurationPicker
                  label="Rest after circuit:"
                  value={circuit.restBetweenCircuitsSeconds}
                  onChange={(s) => onChange({ ...circuit, restBetweenCircuitsSeconds: s })}
                />
              </div>

              <ExerciseList
                exercises={circuit.exercises}
                colorOffset={colorOffset}
                onChange={(exercises) => onChange({ ...circuit, exercises })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
