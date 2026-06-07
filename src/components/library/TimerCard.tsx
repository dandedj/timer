import { Play, Edit2, Copy, Trash2, Layers, Dumbbell, ClipboardList, Download, Monitor, Cloud, CloudUpload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CompoundTimer } from '../../types/timer';
import type { TimerOrigin } from '../../types/sync';
import { computeTotalDuration } from '../../engine/sequenceBuilder';

interface TimerCardProps {
  timer: CompoundTimer;
  origin: TimerOrigin;
  dirty?: boolean;
  isConnected?: boolean;
  showBadge?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onPromote?: () => void;
  confirmingDelete?: boolean;
}

function LocationBadge({ origin, dirty }: { origin: TimerOrigin; dirty?: boolean }) {
  if (origin === 'device') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy/45 bg-brand-navy/5 px-2 py-0.5 rounded-full" title="Saved on this device only">
        <Monitor size={12} /> On this device
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" title="Saving to Google Drive…">
        <CloudUpload size={12} /> Syncing…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full" title="Backed up to Google Drive">
      <Cloud size={12} /> Synced
    </span>
  );
}

export function TimerCard({ timer, origin, dirty, isConnected, showBadge = true, onDuplicate, onDelete, onPromote, confirmingDelete }: TimerCardProps) {
  const navigate = useNavigate();

  const exportTimer = () => {
    const json = JSON.stringify(timer, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(timer.name || 'timer').replace(/[^a-zA-Z0-9_-]/g, '_')}.timer`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSeconds = computeTotalDuration(timer);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const totalCircuits = timer.circuits.length;
  const totalExercises = timer.circuits.reduce((sum, c) => sum + c.exercises.length, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all overflow-hidden group">
      <div className="flex">
        <div className="w-1.5 bg-gradient-to-b from-pink-500 to-purple-600 flex-shrink-0" />
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between mb-3 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-brand-navy">{timer.name || 'Untitled Timer'}</h3>
              {showBadge && <LocationBadge origin={origin} dirty={dirty} />}
            </div>
            <span className="text-sm font-mono font-semibold text-brand bg-brand/10 px-2.5 py-0.5 rounded-full shrink-0">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex gap-4 text-sm text-brand-navy/50 mb-4">
            <span className="flex items-center gap-1">
              <Layers size={13} />
              {totalCircuits} circuit{totalCircuits !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Dumbbell size={13} />
              {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/display/${timer.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-pink-700 hover:to-purple-700 transition-all shadow-sm shadow-pink-600/20"
            >
              <Play size={14} />
              Start
            </button>
            <button
              onClick={() => navigate(`/builder/${timer.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-brand-navy/60 rounded-lg text-sm font-medium hover:bg-brand/5 hover:text-brand transition-colors"
            >
              <Edit2 size={14} />
              Edit
            </button>
            <button
              onClick={() => navigate(`/cheatsheet/${timer.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-brand-navy/60 rounded-lg text-sm font-medium hover:bg-brand/5 hover:text-brand transition-colors"
            >
              <ClipboardList size={14} />
              Cheatsheet
            </button>
            {origin === 'device' && isConnected && onPromote && (
              <button
                onClick={onPromote}
                className="flex items-center gap-1.5 px-3 py-2 text-brand rounded-lg text-sm font-medium hover:bg-brand/10 transition-colors"
                title="Back up this timer to Google Drive"
              >
                <CloudUpload size={14} />
                Save to Drive
              </button>
            )}
            <button
              onClick={exportTimer}
              className="flex items-center gap-1.5 px-3 py-2 text-brand-navy/60 rounded-lg text-sm font-medium hover:bg-brand/5 hover:text-brand transition-colors"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={onDuplicate}
              className="flex items-center gap-1.5 px-3 py-2 text-brand-navy/60 rounded-lg text-sm font-medium hover:bg-brand/5 hover:text-brand transition-colors"
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              onClick={onDelete}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-auto ${
                confirmingDelete
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-brand-navy/30 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              <Trash2 size={14} />
              {confirmingDelete && <span>Delete?</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
