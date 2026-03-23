import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell({ pendingCounts, systemStatus }) {
  return (
    <div className="flex h-screen bg-rowan-bg overflow-hidden">
      <Sidebar pendingCounts={pendingCounts} systemStatus={systemStatus} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
