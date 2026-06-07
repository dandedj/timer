import { useState, useRef, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertCircle, RefreshCw, LogOut, ChevronDown } from 'lucide-react';
import { useGoogleConnection } from '../../hooks/useGoogleConnection';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ConnectionMenu() {
  const {
    isConnected, authStatus, user, connecting, syncStatus, lastSyncedAt,
    connect, disconnect, syncNow,
  } = useGoogleConnection();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = () => { setOpen(false); setConfirming(false); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Not connected — a single clear call to action.
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={connecting || authStatus === 'restoring'}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium disabled:opacity-50"
        title="Back up and sync your timers across devices"
      >
        {connecting || authStatus === 'restoring' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Cloud size={16} />
        )}
        {authStatus === 'restoring' ? 'Reconnecting…' : 'Connect Drive'}
      </button>
    );
  }

  const dot =
    syncStatus === 'syncing' ? <Loader2 size={13} className="animate-spin" /> :
    syncStatus === 'error' ? <AlertCircle size={13} className="text-amber-300" /> :
    syncStatus === 'offline' ? <CloudOff size={13} className="text-white/70" /> :
    <Check size={13} className="text-green-300" />;

  const label =
    syncStatus === 'syncing' ? 'Syncing…' :
    syncStatus === 'error' ? 'Sync paused' :
    syncStatus === 'offline' ? 'Offline' :
    `Synced ${relativeTime(lastSyncedAt)}`.trim();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <Cloud size={16} />
        )}
        <span className="hidden sm:flex items-center gap-1.5">{dot}{label}</span>
        <ChevronDown size={14} className="opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-30 text-brand-navy">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold truncate">{user?.displayName ?? 'Google Drive'}</p>
            {user?.email && <p className="text-xs text-brand-navy/50 truncate">{user.email}</p>}
            <p className="flex items-center gap-1.5 text-xs mt-1.5 text-brand-navy/60">
              {syncStatus === 'syncing' ? <Loader2 size={12} className="animate-spin text-brand" /> :
               syncStatus === 'error' ? <AlertCircle size={12} className="text-amber-500" /> :
               syncStatus === 'offline' ? <CloudOff size={12} className="text-brand-navy/40" /> :
               <Check size={12} className="text-green-600" />}
              {syncStatus === 'syncing' ? 'Syncing…' :
               syncStatus === 'error' ? 'Sync paused — changes are saved on this device' :
               syncStatus === 'offline' ? 'Offline — changes are saved on this device' :
               lastSyncedAt ? `Last synced ${relativeTime(lastSyncedAt)}` : 'Connected'}
            </p>
          </div>

          {!confirming ? (
            <>
              <button
                onClick={() => { syncNow(); close(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <RefreshCw size={15} className="text-brand" /> Sync now
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <LogOut size={15} className="text-brand-navy/50" /> Disconnect
              </button>
            </>
          ) : (
            <div className="px-4 py-2.5">
              <p className="text-xs text-brand-navy/60 mb-2">
                Disconnect Drive? Your timers stay on this device — they just won't sync until you reconnect.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { disconnect(false); close(); }}
                  className="flex-1 px-3 py-1.5 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy/90"
                >
                  Disconnect
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1.5 text-sm text-brand-navy/60 hover:text-brand-navy"
                >
                  Cancel
                </button>
              </div>
              <button
                onClick={() => { disconnect(true); close(); }}
                className="text-xs text-red-500 hover:text-red-600 mt-2.5"
              >
                Sign out &amp; remove access from this app
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
