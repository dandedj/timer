import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

export function AppShell() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="bg-gradient-to-b from-brand/5 to-white min-h-[calc(100vh-64px)]">
        <Outlet />
      </div>
    </div>
  );
}
