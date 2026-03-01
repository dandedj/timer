import { useState } from 'react';
import { Plus, Play, ClipboardList, GripVertical, ArrowUpDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CompoundTimer, Circuit } from '../../types/timer';
import { CircuitCard } from './CircuitCard';
import { DurationPicker } from './DurationPicker';
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

function getExerciseOffsetForCircuit(timer: CompoundTimer, circuitIndex: number): number {
  let offset = 0;
  for (let i = 0; i < circuitIndex; i++) {
    offset += timer.circuits[i].exercises.length;
  }
  return offset;
}

function SortableCircuitCard({
  circuit,
  colorOffset,
  onChange,
  onDelete,
  onDuplicate,
  rearranging,
}: {
  circuit: Circuit;
  colorOffset: number;
  onChange: (c: Circuit) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  rearranging: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: circuit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {rearranging && (
        <button
          className="absolute left-0 top-4 -ml-8 cursor-grab text-brand-navy/30 hover:text-brand-navy/60 z-10"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={20} />
        </button>
      )}
      <CircuitCard
        circuit={circuit}
        colorOffset={colorOffset}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    </div>
  );
}

function InsertCircuitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-brand/50 hover:text-brand mt-1 mb-1 px-3 py-1.5 border border-dashed border-brand/20 rounded-lg w-full justify-center hover:border-brand/40 hover:bg-brand/5 transition-all text-sm font-medium"
    >
      <Plus size={14} />
      Insert Circuit
    </button>
  );
}

export function TimerBuilder({ timer, onChange, onSave, onPreview, onCheatsheet, onCancel }: TimerBuilderProps) {
  const [rearranging, setRearranging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const createCircuit = (insertIndex: number) => {
    const offset = getExerciseOffsetForCircuit(timer, insertIndex);
    const newCircuit: Circuit = {
      id: uuidv4(),
      name: `Circuit ${timer.circuits.length + 1}`,
      exercises: [
        { id: uuidv4(), name: '', durationSeconds: 30, color: colorForIndex(offset) },
      ],
      restBetweenExercisesSeconds: 10,
      sets: 1,
      restBetweenCircuitsSeconds: 15,
    };
    const circuits = [...timer.circuits];
    circuits.splice(insertIndex, 0, newCircuit);
    onChange({ ...timer, circuits });
  };

  const addCircuit = () => {
    createCircuit(timer.circuits.length);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = timer.circuits.findIndex(c => c.id === active.id);
    const newIndex = timer.circuits.findIndex(c => c.id === over.id);
    const circuits = [...timer.circuits];
    const [moved] = circuits.splice(oldIndex, 1);
    circuits.splice(newIndex, 0, moved);
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

      {/* Rearrange toggle */}
      {timer.circuits.length > 1 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setRearranging(!rearranging)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              rearranging
                ? 'bg-brand/10 text-brand'
                : 'text-brand-navy/40 hover:text-brand-navy/60 hover:bg-gray-50'
            }`}
          >
            <ArrowUpDown size={14} />
            {rearranging ? 'Done' : 'Rearrange'}
          </button>
        </div>
      )}

      {rearranging ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={timer.circuits.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="pl-8">
              {timer.circuits.map((circuit, i) => (
                <SortableCircuitCard
                  key={circuit.id}
                  circuit={circuit}
                  colorOffset={getExerciseOffsetForCircuit(timer, i)}
                  onChange={(c) => updateCircuit(i, c)}
                  onDelete={() => deleteCircuit(i)}
                  onDuplicate={() => duplicateCircuit(i)}
                  rearranging
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          {timer.circuits.map((circuit, i) => {
            const isLast = i === timer.circuits.length - 1;
            return (
              <div key={circuit.id}>
                {i > 0 && (
                  <InsertCircuitButton onClick={() => createCircuit(i)} />
                )}
                <CircuitCard
                  circuit={circuit}
                  colorOffset={getExerciseOffsetForCircuit(timer, i)}
                  onChange={(c) => updateCircuit(i, c)}
                  onDelete={() => deleteCircuit(i)}
                  onDuplicate={() => duplicateCircuit(i)}
                />
                {!isLast && (
                  <div className="flex items-center gap-2 px-4 py-2 mb-1">
                    <DurationPicker
                      label="Rest after circuit:"
                      value={circuit.restBetweenCircuitsSeconds}
                      onChange={(s) => updateCircuit(i, { ...circuit, restBetweenCircuitsSeconds: s })}
                      presets={[10, 15, 20, 30]}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

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
