import { Link, useLocation } from 'react-router-dom';
import { Library, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useGoogleConnection, isGoogleDriveAvailable } from '../../hooks/useGoogleConnection';

export function NavBar() {
  const location = useLocation();
  const { isConnected, user, connecting, connect, disconnect } = useGoogleConnection();
  const driveAvailable = isGoogleDriveAvailable();

  return (
    <nav className="bg-gradient-to-r from-brand-dark via-brand to-[#0a7a8f] text-white px-6 py-3 flex items-center gap-6 shadow-md">
      <Link to="/library" className="flex items-center gap-3 font-bold text-lg">
        <img src={`${import.meta.env.BASE_URL}logo-circle.png`} alt="Joan's Fit Zone" className="h-10 w-10 rounded-full ring-2 ring-white/30" />
        <span className="tracking-tight">Joan's Fit Zone Timer</span>
      </Link>
      <div className="flex gap-4 ml-auto items-center">
        <Link
          to="/library"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
            location.pathname === '/library'
              ? 'bg-white/20'
              : 'hover:bg-white/10'
          }`}
        >
          <Library size={16} />
          My Timers
        </Link>

        {driveAvailable && (
          isConnected ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
              title="Disconnect Google Drive"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <Cloud size={16} />
              )}
              <span className="hidden sm:inline">{user?.displayName ?? 'Connected'}</span>
              <CloudOff size={14} className="opacity-60" />
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Cloud size={16} />
              )}
              Connect Drive
            </button>
          )
        )}
      </div>
    </nav>
  );
}
