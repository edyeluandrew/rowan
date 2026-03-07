import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-rowan-bg text-rowan-text">
      <Outlet />
      <BottomNav />
    </div>
  );
}
