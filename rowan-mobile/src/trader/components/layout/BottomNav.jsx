import { NavLink } from 'react-router-dom';
import { Home, Inbox, Clock, UserCircle } from 'lucide-react';
import { useRequests } from '../../hooks/useRequests';

const tabs = [
  { to: '/trader/home',     label: 'Home',     icon: Home },
  { to: '/trader/requests', label: 'Requests', icon: Inbox,      showBadge: true },
  { to: '/trader/history',  label: 'History',  icon: Clock },
  { to: '/trader/profile',  label: 'Profile',  icon: UserCircle },
];

export default function BottomNav() {
  const { pending } = useRequests();
  const pendingCount = pending?.length || 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-rowan-surface border-t border-rowan-border flex z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 relative select-none ${
                isActive ? 'text-rowan-green' : 'text-rowan-muted'
              }`
            }
          >
            <div className="relative">
              <Icon size={22} />
            </div>
            <span className="text-xs">{tab.label}</span>
            {tab.showBadge && pendingCount > 0 && (
              <span className="absolute top-1 right-1/4 bg-rowan-red text-white text-xs rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
