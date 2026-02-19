import { Plus, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CompoundTimer } from '../../types/timer';
import { TimerCard } from './TimerCard';

interface TimerLibraryProps {
  timers: CompoundTimer[];
  loading: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TimerLibrary({ timers, loading, onDuplicate, onDelete }: TimerLibraryProps) {
  const navigate = useNavigate();

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-navy/50">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-brand-navy tracking-tight">My Timers</h1>
        <button
          onClick={() => navigate('/builder')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-700 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-pink-600/20"
        >
          <Plus size={18} strokeWidth={2.5} />
          New Timer
        </button>
      </div>

      {timers.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 mb-4">
            <Timer size={28} className="text-brand" />
          </div>
          <p className="text-lg font-medium text-brand-navy/70 mb-1">No timers yet</p>
          <p className="text-sm text-brand-navy/40">Create your first timer to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {timers.map(timer => (
            <TimerCard
              key={timer.id}
              timer={timer}
              onDuplicate={() => onDuplicate(timer.id)}
              onDelete={() => onDelete(timer.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
