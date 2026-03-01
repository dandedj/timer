import { Clock, Repeat, Layers } from 'lucide-react';
import type { CompoundTimer } from '../../types/timer';
import { buildSequence } from '../../engine/sequenceBuilder';
import { TimelineBar } from './TimelineBar';

interface TimerPreviewProps {
  timer: CompoundTimer;
}

export function TimerPreview({ timer }: TimerPreviewProps) {
  const sequence = buildSequence(timer);
  const totalSeconds = sequence.reduce((s, i) => s + i.durationSeconds, 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="bg-gradient-to-r from-brand-dark to-brand rounded-xl p-5 text-white shadow-sm">
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-xs text-white/60 uppercase tracking-wider font-medium">Duration</div>
            <div className="font-bold text-lg font-mono">{minutes}:{seconds.toString().padStart(2, '0')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <Repeat size={18} />
          </div>
          <div>
            <div className="text-xs text-white/60 uppercase tracking-wider font-medium">Intervals</div>
            <div className="font-bold text-lg">{sequence.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <Layers size={18} />
          </div>
          <div>
            <div className="text-xs text-white/60 uppercase tracking-wider font-medium">Circuits</div>
            <div className="font-bold text-lg">{timer.circuits.length}</div>
          </div>
        </div>
      </div>
      <TimelineBar timer={timer} />
    </div>
  );
}
