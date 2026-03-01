import { Plus, Play, ClipboardList } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { CompoundTimer, Circuit } from '../../types/timer';
import { CircuitCard } from './CircuitCard';
import { TimerPreview } from './TimerPreview';
import { colorForIndex } from '../../engine/colorPalette';

interface TimerBuilderProps {
  timer: CompoundTimer;
  onChange: (timer: CompoundTimer) => void;
  onSave: () => void;
  onPreview: () => void;
  onCheatsheet: () => void;
  onCancel: () => void;
}

function getTotalExerciseCount(timer: CompoundTimer): number {
  return timer.circuits.reduce((sum, c) => sum + c.exercises.length, 0);
}

function getExerciseOffsetForCircuit(timer: CompoundTimer, circuitIndex: number): number {
  let offset = 0;
  for (let i = 0; i < circuitIndex; i++) {
    offset += timer.circuits[i].exercises.length;
  }
  return offset;
}

export function TimerBuilder({ timer, onChange, onSave, onPreview, onCheatsheet, onCancel }: TimerBuilderProps) {
  const addCircuit = () => {
    const offset = getTotalExerciseCount(timer);
    const newCircuit: Circuit = {
      id: uuidv4(),
      name: `Circuit ${timer.circuits.length + 1}`,
      exercises: [
        { id: uuidv4(), name: '', durationSeconds: 30, color: colorForIndex(offset) },
      ],
      restBetweenExercisesSeconds: 10,
      sets: 1,
      restBetweenSetsSeconds: 30,
    };
    onChange({ ...timer, circuits: [...timer.circuits, newCircuit] });
  };

  const updateCircuit = (index: number, circuit: Circuit) => {
    const updated = [...timer.circuits];
    updated[index] = circuit;
    onChange({ ...timer, circuits: updated });
  };

  const deleteCircuit = (index: number) => {
    onChange({ ...timer, circuits: timer.circuits.filter((_, i) => i !== index) });
  };

  const duplicateCircuit = (index: number) => {
    const original = timer.circuits[index];
    const copy: Circuit = {
      ...original,
      id: uuidv4(),
      name: `${original.name} (copy)`,
      exercises: original.exercises.map(e => ({ ...e, id: uuidv4() })),
    };
    const circuits = [...timer.circuits];
    circuits.splice(index + 1, 0, copy);
    onChange({ ...timer, circuits });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <input
          type="text"
          value={timer.name}
          onChange={(e) => onChange({ ...timer, name: e.target.value })}
          placeholder="Timer name"
          className="text-3xl font-extrabold text-brand-navy tracking-tight border-b-2 border-transparent focus:border-brand outline-none pb-1 flex-1 mr-4 bg-transparent placeholder:text-brand-navy/25"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-brand-navy/60 hover:text-brand-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onCheatsheet}
            className="flex items-center gap-1.5 px-4 py-2.5 text-brand-navy/60 hover:text-brand-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <ClipboardList size={15} />
            Cheatsheet
          </button>
          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-brand-navy text-brand-navy rounded-xl hover:bg-brand-navy hover:text-white transition-colors font-semibold"
          >
            <Play size={15} />
            Preview
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-700 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-pink-600/20"
          >
            Save Timer
          </button>
        </div>
      </div>

      <div className="mb-8">
        <TimerPreview timer={timer} />
      </div>

      {timer.circuits.map((circuit, i) => (
        <CircuitCard
          key={circuit.id}
          circuit={circuit}
          colorOffset={getExerciseOffsetForCircuit(timer, i)}
          onChange={(c) => updateCircuit(i, c)}
          onDelete={() => deleteCircuit(i)}
          onDuplicate={() => duplicateCircuit(i)}
        />
      ))}

      <button
        onClick={addCircuit}
        className="flex items-center gap-2 text-brand hover:text-brand-dark mt-4 px-4 py-3.5 border-2 border-dashed border-brand/20 rounded-xl w-full justify-center hover:border-brand/40 hover:bg-brand/5 transition-all font-medium"
      >
        <Plus size={20} />
        Add Circuit
      </button>
    </div>
  );
}
