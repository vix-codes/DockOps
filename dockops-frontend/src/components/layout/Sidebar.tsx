import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Container,
  Rocket,
  FolderGit2,
  LogOut,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', to: '/' },
  { icon: Server, label: 'Nodes', to: '/nodes' },
  { icon: Container, label: 'Containers', to: '/containers' },
  { icon: FolderGit2, label: 'Projects', to: '/projects' },
  { icon: Rocket, label: 'Deployments', to: '/deployments' },
  { icon: Activity, label: 'Metrics', to: '/metrics' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] h-screen sticky top-0">
      <div className="p-5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[hsl(var(--primary))]/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">DockOps</span>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-none mt-0.5">Infrastructure Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[hsl(var(--border))]">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary))]/20 flex items-center justify-center text-[hsl(var(--primary))] text-xs font-semibold">
            {user?.fullName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.fullName}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              {user?.role?.replace('ROLE_', '')}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--destructive))] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
