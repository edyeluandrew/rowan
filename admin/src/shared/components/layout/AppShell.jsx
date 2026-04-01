import { Outlet } from 'react-router-dom'
import Sidebar from '../../../features/layout/components/Sidebar'

/**
 * Main application shell layout
 * Provides sidebar navigation and main content area
 */
export default function AppShell() {
  return (
    <div className="flex h-screen bg-rowan-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
