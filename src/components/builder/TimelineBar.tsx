import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CompoundTimer } from '../../types/timer';
import type { FlatInterval } from '../../types/timer';
import { buildSequence } from '../../engine/sequenceBuilder';

interface TimelineBarProps {
  timer: CompoundTimer;
}

const CLASS_LENGTHS = [30, 45, 60];
const REST_COLOR = '#9ca3af'; // gray-400

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimelineBar({ timer }: TimelineBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [targetMinutes, setTargetMinutes] = useState(45);
  const [waitMinutes, setWaitMinutes] = useState(2);
  const [warmupMinutes, setWarmupMinutes] = useState(8);

  const sequence = useMemo(() => buildSequence(timer), [timer]);
  const totalSeconds = useMemo(
    () => sequence.reduce((sum, i) => sum + i.durationSeconds, 0),
    [sequence],
  );

  const preTimerSeconds = (waitMinutes + warmupMinutes) * 60;
  const targetSeconds = targetMinutes * 60;
  const availableSeconds = targetSeconds - preTimerSeconds;
  const remainingSeconds = availableSeconds - totalSeconds;
  const overflows = totalSeconds > availableSeconds;

  // Group intervals by circuit for expanded view
  const circuitGroups = useMemo(() => {
    const groups: { circuitName: string; circuitIndex: number; intervals: FlatInterval[] }[] = [];
    let current: (typeof groups)[number] | null = null;

    for (const interval of sequence) {
      if (!current || current.circuitIndex !== interval.circuitIndex) {
        current = { circuitName: interval.circuitName, circuitIndex: interval.circuitIndex, intervals: [] };
        groups.push(current);
      }
      current.intervals.push(interval);
    }
    return groups;
  }, [sequence]);

  // Compute cumulative times
  const cumulativeTimes = useMemo(() => {
    const times: number[] = [];
    let running = 0;
    for (const interval of sequence) {
      running += interval.durationSeconds;
      times.push(running);
    }
    return times;
  }, [sequence]);

  return (
    <div className="mt-4">
      {/* Class timing settings */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        {/* Class length */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 uppercase tracking-wider font-medium whitespace-nowrap">
            Class
          </span>
          <div className="flex gap-1.5">
            {CLASS_LENGTHS.map((len) => (
              <button
                key={len}
                onClick={() => setTargetMinutes(len)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  targetMinutes === len
                    ? 'bg-white/25 text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/70'
                }`}
              >
                {len}m
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={180}
              value={targetMinutes}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v > 0) setTargetMinutes(v);
              }}
              className="w-14 bg-white/10 text-white text-xs font-mono rounded-lg px-2 py-1 text-center outline-none focus:bg-white/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-white/40">min</span>
          </div>
        </div>

        <div className="w-px h-4 bg-white/15" />

        {/* Wait time */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/60 uppercase tracking-wider font-medium whitespace-nowrap">
            Wait
          </span>
          <input
            type="number"
            min={0}
            max={30}
            value={waitMinutes}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0) setWaitMinutes(v);
            }}
            className="w-12 bg-white/10 text-white text-xs font-mono rounded-lg px-2 py-1 text-center outline-none focus:bg-white/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-white/40">min</span>
        </div>

        {/* Warmup time */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/60 uppercase tracking-wider font-medium whitespace-nowrap">
            Warmup
          </span>
          <input
            type="number"
            min={0}
            max={30}
            value={warmupMinutes}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0) setWarmupMinutes(v);
            }}
            className="w-12 bg-white/10 text-white text-xs font-mono rounded-lg px-2 py-1 text-center outline-none focus:bg-white/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-white/40">min</span>
        </div>
      </div>

      {/* Collapsed bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer group"
      >
        <div className="relative h-6 bg-white/10 rounded-lg overflow-hidden flex">
          {/* Pre-timer block (wait + warmup) */}
          {preTimerSeconds > 0 && (
            <div
              className="h-full bg-white/15 flex items-center justify-center"
              style={{ width: `${(preTimerSeconds / targetSeconds) * 100}%` }}
            >
              <span className="text-[9px] text-white/40 truncate px-1">
                {waitMinutes + warmupMinutes}m
              </span>
            </div>
          )}
          {/* Workout segments */}
          {sequence.map((interval, idx) => {
            const widthPct = (interval.durationSeconds / targetSeconds) * 100;
            return (
              <div
                key={interval.id + '-' + idx}
                className="h-full transition-opacity group-hover:opacity-90"
                style={{
                  width: `${widthPct}%`,
                  minWidth: '2px',
                  backgroundColor: interval.kind === 'work' ? interval.color : REST_COLOR,
                  opacity: interval.kind === 'work' ? 1 : 0.4,
                }}
              />
            );
          })}
          {/* Overflow indicator */}
          {overflows && (
            <div className="absolute right-0 top-0 h-full px-2 flex items-center bg-red-500/80 text-[10px] font-bold text-white whitespace-nowrap">
              +{formatTime(totalSeconds - availableSeconds)}
            </div>
          )}
        </div>

        {/* Labels below bar */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/80">{formatTime(totalSeconds)}</span>
            {!overflows && remainingSeconds > 0 && (
              <span className="text-xs text-white/40">
                {formatTime(remainingSeconds)} remaining
              </span>
            )}
            {overflows && (
              <span className="text-xs text-red-300">
                over by {formatTime(totalSeconds - availableSeconds)}
              </span>
            )}
          </div>
          <div className="text-white/40">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg bg-white/5 divide-y divide-white/5">
          {circuitGroups.map((group) => (
            <div key={group.circuitIndex}>
              {/* Circuit header */}
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40 bg-white/5 sticky top-0">
                {group.circuitName}
              </div>
              {group.intervals.map((interval) => {
                const globalIdx = sequence.indexOf(interval);
                const cumulative = cumulativeTimes[globalIdx];
                const kindLabel =
                  interval.kind === 'work'
                    ? ''
                    : interval.kind === 'rest-exercise'
                      ? 'Rest'
                      : interval.kind === 'rest-set'
                        ? `Rest (between sets)`
                        : 'Rest (between circuits)';
                const displayLabel = interval.kind === 'work' ? interval.label : kindLabel;
                const setInfo =
                  interval.totalSets > 1
                    ? `Set ${interval.setNumber}/${interval.totalSets}`
                    : '';

                return (
                  <div
                    key={interval.id + '-' + globalIdx}
                    className="flex items-center gap-2.5 px-3 py-1.5 text-xs"
                  >
                    {/* Color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: interval.kind === 'work' ? interval.color : REST_COLOR }}
                    />
                    {/* Label */}
                    <div className="flex-1 min-w-0 truncate text-white/80">
                      {displayLabel}
                      {setInfo && (
                        <span className="text-white/30 ml-1.5">{setInfo}</span>
                      )}
                    </div>
                    {/* Duration */}
                    <span className="font-mono text-white/60 flex-shrink-0">
                      {formatTime(interval.durationSeconds)}
                    </span>
                    {/* Cumulative */}
                    <span className="font-mono text-white/35 flex-shrink-0 w-14 text-right">
                      at {formatTime(cumulative)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
