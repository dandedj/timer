import { Link, useLocation } from 'react-router-dom';
import { Library } from 'lucide-react';

export function NavBar() {
  const location = useLocation();

  return (
    <nav className="bg-gradient-to-r from-brand-dark via-brand to-[#0a7a8f] text-white px-6 py-3 flex items-center gap-6 shadow-md">
      <Link to="/library" className="flex items-center gap-3 font-bold text-lg">
        <img src="/logo-circle.png" alt="Joan's Fit Zone" className="h-10 w-10 rounded-full ring-2 ring-white/30" />
        <span className="tracking-tight">Joan's Fit Zone Timer</span>
      </Link>
      <div className="flex gap-4 ml-auto">
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
      </div>
    </nav>
  );
}
