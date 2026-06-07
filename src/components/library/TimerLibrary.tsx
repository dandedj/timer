import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Plus, Timer, Upload, FileText, Cloud, CloudOff, Monitor, Loader2, X,
  Check, AlertCircle, RefreshCw, Clipboard, ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LibraryTimer, AuthStatus, SyncStatus } from '../../types/sync';
import { TimerCard } from './TimerCard';

export interface ImportResult {
  name: string;
  ok: boolean;
  message?: string;
}

interface TimerLibraryProps {
  timers: LibraryTimer[];
  deviceTimers: LibraryTimer[];
  driveTimers: LibraryTimer[];
  loading: boolean;
  driveAvailable: boolean;
  isConnected: boolean;
  authStatus: AuthStatus;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  connecting: boolean;
  onConnect: () => void;
  onSyncNow: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string) => void;
  deleteConfirmId?: string | null;
  onImportFiles: (files: File[]) => void;
  onImportText: (text: string) => void;
  importResults: ImportResult[] | null;
  onDismissResults: () => void;
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
      <div className="h-5 w-40 bg-gray-100 rounded mb-3" />
      <div className="h-3 w-24 bg-gray-100 rounded mb-4" />
      <div className="h-9 w-full bg-gray-50 rounded" />
    </div>
  );
}

export function TimerLibrary(props: TimerLibraryProps) {
  const {
    timers, deviceTimers, driveTimers, loading, driveAvailable, isConnected, authStatus,
    syncStatus, lastSyncedAt, connecting, onConnect, onSyncNow, onDuplicate, onDelete,
    onPromote, deleteConfirmId, onImportFiles, onImportText, importResults, onDismissResults,
  } = props;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  // Full-window drag-and-drop import.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      if (files.length) onImportFiles(files);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [onImportFiles]);

  const submitPaste = useCallback(() => {
    if (pasteText.trim()) onImportText(pasteText);
    setPasteText('');
    setPasteOpen(false);
  }, [pasteText, onImportText]);

  const totalTimers = deviceTimers.length + driveTimers.length;
  const showEmpty = !loading && totalTimers === 0 && authStatus !== 'restoring';
  // The two-section local/Drive split only makes sense while connected (or restoring).
  // When disconnected we collapse to one plain list so there's no stray "Drive" section.
  const twoSection = driveAvailable && (isConnected || authStatus === 'restoring');

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-extrabold text-brand-navy tracking-tight">My Timers</h1>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".timer,.json,application/json"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length) onImportFiles(files);
              e.target.value = '';
            }}
          />
          <div className="relative">
            <button
              onClick={() => setImportMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setImportMenuOpen(false), 150)}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-brand-navy text-brand-navy rounded-xl hover:bg-brand-navy hover:text-white transition-all font-semibold"
            >
              <Upload size={18} strokeWidth={2.5} />
              Import
              <ChevronDown size={16} />
            </button>
            {importMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
                <button
                  onMouseDown={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm text-brand-navy hover:bg-gray-50"
                >
                  <Upload size={16} className="text-brand" /> Choose file(s)…
                </button>
                <button
                  onMouseDown={() => setPasteOpen(true)}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm text-brand-navy hover:bg-gray-50"
                >
                  <Clipboard size={16} className="text-brand" /> Paste JSON
                </button>
                <a
                  href={`${import.meta.env.BASE_URL}timer-format.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm text-brand-navy/70 hover:bg-gray-50 border-t border-gray-100"
                >
                  <FileText size={16} /> Format guide
                </a>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/builder')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-700 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-pink-600/20"
          >
            <Plus size={18} strokeWidth={2.5} />
            New Timer
          </button>
        </div>
      </div>
      <p className="text-sm text-brand-navy/40 mb-6 -mt-3">Tip: drag &amp; drop timer files anywhere to import.</p>

      {/* Import results */}
      {importResults && importResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-brand-navy">
              Imported {importResults.filter((r) => r.ok).length} of {importResults.length}
            </p>
            <button onClick={onDismissResults} className="p-1 text-gray-400 hover:text-gray-600" title="Dismiss">
              <X size={16} />
            </button>
          </div>
          <ul className="space-y-1">
            {importResults.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.ok ? (
                  <Check size={15} className="text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                )}
                <span className={r.ok ? 'text-brand-navy/70' : 'text-red-600'}>
                  <span className="font-medium">{r.name}</span>
                  {r.message ? ` — ${r.message}` : r.ok ? ' imported' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showEmpty ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 mb-4">
            <Timer size={28} className="text-brand" />
          </div>
          <p className="text-lg font-medium text-brand-navy/70 mb-1">No timers yet</p>
          <p className="text-sm text-brand-navy/40 mb-5">Create your first timer, or import one.</p>
          {driveAvailable && !isConnected && (
            <button
              onClick={onConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand border border-brand/30 rounded-xl hover:bg-brand/5 disabled:opacity-50"
            >
              {connecting ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
              Connect Google Drive to sync across devices
            </button>
          )}
        </div>
      ) : !twoSection ? (
        // Disconnected (or Drive not configured) — one plain list, no Drive section.
        <div className="space-y-4">
          {driveAvailable && !isConnected && (
            <button
              onClick={onConnect}
              disabled={connecting}
              className="flex w-full items-center gap-3 bg-brand/5 border border-brand/15 rounded-xl px-4 py-3 text-left hover:bg-brand/10 transition-colors disabled:opacity-50"
            >
              {connecting ? <Loader2 size={18} className="text-brand animate-spin" /> : <Cloud size={18} className="text-brand" />}
              <span className="text-sm text-brand-navy/70 flex-1">Connect Google Drive to back up your timers and sync across devices.</span>
              <span className="text-sm font-semibold text-brand">Connect</span>
            </button>
          )}
          <div className="grid gap-4">
            {timers.map((t) => (
              <TimerCard
                key={t.id}
                timer={t}
                origin={t.origin}
                dirty={t.dirty}
                showBadge={false}
                onDuplicate={() => onDuplicate(t.id)}
                onDelete={() => onDelete(t.id)}
                confirmingDelete={deleteConfirmId === t.id}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* On this device */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-navy/50 mb-3">
              <Monitor size={15} /> On this device
              <span className="text-brand-navy/30 font-semibold normal-case tracking-normal">({deviceTimers.length})</span>
            </h2>
            {deviceTimers.length === 0 ? (
              <p className="text-sm text-brand-navy/40 bg-gray-50 rounded-xl px-4 py-3">
                Nothing saved only on this device.{isConnected ? ' New and imported timers back up to Drive automatically.' : ''}
              </p>
            ) : (
              <div className="grid gap-4">
                {deviceTimers.map((t) => (
                  <TimerCard
                    key={t.id}
                    timer={t}
                    origin={t.origin}
                    dirty={t.dirty}
                    isConnected={isConnected}
                    onDuplicate={() => onDuplicate(t.id)}
                    onDelete={() => onDelete(t.id)}
                    onPromote={() => onPromote(t.id)}
                    confirmingDelete={deleteConfirmId === t.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Synced to Google Drive */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-navy/50">
                <Cloud size={15} /> Synced to Google Drive
                {isConnected && (
                  <span className="text-brand-navy/30 font-semibold normal-case tracking-normal">({driveTimers.length})</span>
                )}
              </h2>
              <DriveStatus
                authStatus={authStatus}
                isConnected={isConnected}
                syncStatus={syncStatus}
                lastSyncedAt={lastSyncedAt}
                connecting={connecting}
                onConnect={onConnect}
                onSyncNow={onSyncNow}
              />
            </div>
            {authStatus === 'restoring' && driveTimers.length === 0 ? (
              <div className="grid gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cached Drive timers stay visible even when disconnected (offline-first). */}
                {!isConnected && authStatus !== 'restoring' && (
                  <div className="bg-brand/5 border border-brand/15 rounded-xl px-5 py-4 flex items-center gap-3">
                    <Cloud size={22} className="text-brand shrink-0" />
                    <p className="text-sm text-brand-navy/70 flex-1">
                      {driveTimers.length > 0
                        ? 'Reconnect Google Drive to keep these backed up and synced across devices.'
                        : 'Connect Google Drive to back up your timers and use them on any device.'}
                    </p>
                    <button
                      onClick={onConnect}
                      disabled={connecting}
                      className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50"
                    >
                      {connecting ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
                      {driveTimers.length > 0 ? 'Reconnect' : 'Connect'}
                    </button>
                  </div>
                )}
                {driveTimers.length > 0 ? (
                  <div className="grid gap-4">
                    {driveTimers.map((t) => (
                      <TimerCard
                        key={t.id}
                        timer={t}
                        origin={t.origin}
                        dirty={t.dirty}
                        isConnected={isConnected}
                        onDuplicate={() => onDuplicate(t.id)}
                        onDelete={() => onDelete(t.id)}
                        confirmingDelete={deleteConfirmId === t.id}
                      />
                    ))}
                  </div>
                ) : isConnected ? (
                  <p className="text-sm text-brand-navy/40 bg-gray-50 rounded-xl px-4 py-3">
                    No timers in Drive yet. Use “Save to Drive” on a device timer, or create one while connected.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-50 bg-brand/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-dashed border-brand px-12 py-10 text-center">
            <Upload size={40} className="text-brand mx-auto mb-3" />
            <p className="text-lg font-semibold text-brand-navy">Drop to import</p>
            <p className="text-sm text-brand-navy/50">.timer or Seconds Pro files</p>
          </div>
        </div>
      )}

      {/* Paste JSON modal */}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setPasteOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-brand-navy">Paste timer JSON</h3>
              <button onClick={() => setPasteOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-brand-navy/50 mb-3">Paste a .timer or Seconds Pro JSON (e.g. from AI or an email).</p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              autoFocus
              rows={10}
              placeholder='{ "name": "My Workout", "circuits": [ ... ] }'
              className="w-full border border-gray-200 rounded-xl p-3 font-mono text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPasteOpen(false)} className="px-4 py-2 text-sm font-medium text-brand-navy/60 hover:text-brand-navy">
                Cancel
              </button>
              <button
                onClick={submitPaste}
                disabled={!pasteText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-40"
              >
                <Upload size={15} /> Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriveStatus({
  authStatus, isConnected, syncStatus, lastSyncedAt, connecting, onConnect, onSyncNow,
}: {
  authStatus: AuthStatus;
  isConnected: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  connecting: boolean;
  onConnect: () => void;
  onSyncNow: () => void;
}) {
  if (authStatus === 'restoring') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-brand-navy/40">
        <Loader2 size={13} className="animate-spin" /> Restoring session…
      </span>
    );
  }
  if (!isConnected) {
    return (
      <button
        onClick={onConnect}
        disabled={connecting}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark disabled:opacity-50"
      >
        {connecting ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />} Connect
      </button>
    );
  }
  if (syncStatus === 'syncing') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-brand">
        <Loader2 size={13} className="animate-spin" /> Syncing…
      </span>
    );
  }
  if (syncStatus === 'error') {
    return (
      <button onClick={onSyncNow} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700">
        <AlertCircle size={13} /> Sync paused — retry
      </button>
    );
  }
  if (syncStatus === 'offline') {
    return (
      <button onClick={onSyncNow} className="flex items-center gap-1.5 text-xs font-medium text-brand-navy/50 hover:text-brand-navy">
        <CloudOff size={13} /> Offline — retry
      </button>
    );
  }
  return (
    <button onClick={onSyncNow} className="flex items-center gap-1.5 text-xs font-medium text-brand-navy/45 hover:text-brand" title="Sync now">
      <Check size={13} className="text-green-600" /> Synced{lastSyncedAt ? ` ${relativeTime(lastSyncedAt)}` : ''} <RefreshCw size={11} className="opacity-50" />
    </button>
  );
}
