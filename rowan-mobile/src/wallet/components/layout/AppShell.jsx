import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

/**
 * App shell for authenticated routes — wraps content with bottom nav.
 */
export default function AppShell() {
  return (
    <div className="bg-rowan-bg min-h-screen text-rowan-text">
      <div className="pb-20">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
