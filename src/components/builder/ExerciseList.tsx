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
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Exercise } from '../../types/timer';
import { ExerciseRow } from './ExerciseRow';
import { colorForIndex } from '../../engine/colorPalette';

interface ExerciseListProps {
  exercises: Exercise[];
  onChange: (exercises: Exercise[]) => void;
  colorOffset?: number;
}

export function ExerciseList({ exercises, onChange, colorOffset = 0 }: ExerciseListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = exercises.findIndex(e => e.id === active.id);
    const newIndex = exercises.findIndex(e => e.id === over.id);
    const updated = [...exercises];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved);
    onChange(updated);
  };

  const addExercise = () => {
    onChange([
      ...exercises,
      {
        id: uuidv4(),
        name: '',
        durationSeconds: 30,
        color: colorForIndex(colorOffset + exercises.length),
      },
    ]);
  };

  const updateExercise = (index: number, exercise: Exercise) => {
    const updated = [...exercises];
    updated[index] = exercise;
    onChange(updated);
  };

  const deleteExercise = (index: number) => {
    onChange(exercises.filter((_, i) => i !== index));
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {exercises.map((exercise, i) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              onChange={(e) => updateExercise(i, e)}
              onDelete={() => deleteExercise(i)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={addExercise}
        className="flex items-center gap-2 text-sm text-brand hover:text-brand-dark mt-2 px-3 py-2 border border-dashed border-brand/30 rounded-lg w-full justify-center hover:bg-brand/5 transition-colors"
      >
        <Plus size={16} />
        Add Exercise
      </button>
    </div>
  );
}
