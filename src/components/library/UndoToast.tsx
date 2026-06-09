import { Trash2 } from 'lucide-react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
}

/** Bottom-of-viewport toast shown while a delete is pending, with a large Undo target. */
export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-brand-navy text-white rounded-2xl shadow-2xl pl-5 pr-2 py-2 max-w-[calc(100vw-2rem)]">
      <Trash2 size={16} className="text-white/60 shrink-0" />
      <span className="text-sm font-medium truncate">{message}</span>
      <button
        onClick={onUndo}
        className="shrink-0 px-5 py-3 rounded-xl text-sm font-bold text-pink-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        Undo
      </button>
    </div>
  );
}
