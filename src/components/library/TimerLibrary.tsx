import { useRef } from 'react';
import { Plus, Timer, Upload, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CompoundTimer } from '../../types/timer';
import { TimerCard } from './TimerCard';

interface TimerLibraryProps {
  timers: CompoundTimer[];
  loading: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  deleteConfirmId?: string | null;
  onImport: (file: File) => Promise<void>;
  importError?: string | null;
}

export function TimerLibrary({ timers, loading, onDuplicate, onDelete, onImport, importError, deleteConfirmId }: TimerLibraryProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-brand-navy/50">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-brand-navy tracking-tight">My Timers</h1>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".timer"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <a
            href={`${import.meta.env.BASE_URL}timer-format.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 text-brand-navy/60 hover:text-brand-navy border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            <FileText size={18} strokeWidth={2.5} />
            Format Guide
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-brand-navy text-brand-navy rounded-xl hover:bg-brand-navy hover:text-white transition-all font-semibold"
          >
            <Upload size={18} strokeWidth={2.5} />
            Import
          </button>
          <button
            onClick={() => navigate('/builder')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-700 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-pink-600/20"
          >
            <Plus size={18} strokeWidth={2.5} />
            New Timer
          </button>
        </div>
      </div>
      {importError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-4">{importError}</p>
      )}

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
              confirmingDelete={deleteConfirmId === timer.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
