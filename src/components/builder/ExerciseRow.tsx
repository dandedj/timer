import { useState, useRef, useEffect, useMemo } from 'react';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Exercise } from '../../types/timer';
import { DurationPicker } from './DurationPicker';
import { EXERCISE_NAMES } from '../../data/exercises';

interface ExerciseRowProps {
  exercise: Exercise;
  onChange: (exercise: Exercise) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function ExerciseRow({ exercise, onChange, onDelete, onCopy }: ExerciseRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  const suggestions = useMemo(() => {
    const query = exercise.name.toLowerCase().trim();
    if (!query) return [];
    return EXERCISE_NAMES.filter((name) =>
      name.toLowerCase().includes(query),
    ).slice(0, 8);
  }, [exercise.name]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const selectSuggestion = (name: string) => {
    onChange({ ...exercise, name });
    setShowSuggestions(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
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

      <div className="relative flex-1 min-w-0" ref={wrapperRef}>
        <input
          type="text"
          value={exercise.name}
          onChange={(e) => {
            onChange({ ...exercise, name: e.target.value });
            setShowSuggestions(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => {
            if (exercise.name.trim()) setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Exercise name"
          className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm text-brand-navy font-medium bg-white focus:border-brand focus:outline-none placeholder:text-brand-navy/25"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1"
          >
            {suggestions.map((name, idx) => (
              <li
                key={name}
                onMouseDown={() => selectSuggestion(name)}
                className={`px-3 py-1.5 text-sm cursor-pointer ${
                  idx === highlightIndex
                    ? 'bg-brand/10 text-brand-navy font-medium'
                    : 'text-brand-navy/70 hover:bg-gray-50'
                }`}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DurationPicker
        value={exercise.durationSeconds}
        onChange={(s) => onChange({ ...exercise, durationSeconds: s })}
        presets={[25, 30, 35, 40, 45, 60]}
      />

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
