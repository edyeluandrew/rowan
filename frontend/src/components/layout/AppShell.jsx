import { Outlet } from 'react-router-dom';
import { useConnectionMonitor } from '../../hooks/useConnectionMonitor';
import BottomNav from './BottomNav';

export default function AppShell() {
  // Monitor socket connection status and show toasts
  useConnectionMonitor();

  return (
    <div className="min-h-screen bg-rowan-bg text-rowan-text">
      <Outlet />
      <BottomNav />
    </div>
  );
}
