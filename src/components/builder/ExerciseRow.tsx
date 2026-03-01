import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Exercise } from '../../types/timer';
import { DurationPicker } from './DurationPicker';

interface ExerciseRowProps {
  exercise: Exercise;
  onChange: (exercise: Exercise) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function ExerciseRow({ exercise, onChange, onDelete, onCopy }: ExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-gray-50/80 border border-gray-100 rounded-lg p-3 mb-2"
    >
      <button
        className="cursor-grab text-brand-navy/20 hover:text-brand-navy/40"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>

      <div
        className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
        style={{ backgroundColor: exercise.color }}
      />

      <input
        type="text"
        value={exercise.name}
        onChange={(e) => onChange({ ...exercise, name: e.target.value })}
        placeholder="Exercise name"
        className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-brand-navy font-medium min-w-0 bg-white focus:border-brand focus:outline-none placeholder:text-brand-navy/25"
      />

      <DurationPicker
        value={exercise.durationSeconds}
        onChange={(s) => onChange({ ...exercise, durationSeconds: s })}
        presets={[25, 30, 35, 40, 45, 60]}
      />

      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={exercise.repCount ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onChange({ ...exercise, repCount: isNaN(val) || val === 0 ? undefined : val });
          }}
          placeholder="Reps"
          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center text-sm text-brand-navy bg-white focus:border-brand focus:outline-none"
        />
        <span className="text-xs text-brand-navy/30">reps</span>
      </div>

      <button
        onClick={onCopy}
        className="text-brand-navy/20 hover:text-brand transition-colors"
        title="Duplicate exercise"
      >
        <Copy size={16} />
      </button>
      <button
        onClick={onDelete}
        className="text-brand-navy/20 hover:text-red-500 transition-colors"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
