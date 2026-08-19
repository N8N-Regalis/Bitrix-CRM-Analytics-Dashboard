import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Handshake, Users, Contact2, LineChart, ArrowRightLeft, Send, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/deals', label: 'Deals', icon: Handshake },
  { to: '/associates', label: 'Associates', icon: Users },
  { to: '/clients', label: 'Clients', icon: Contact2 },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/stage-movement', label: 'Stage Movement', icon: ArrowRightLeft },
  { to: '/presented-deals', label: 'Presented Deals', icon: Send },
];

export function NavItem({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/80'
            )}
          />
          <span className="flex-1 truncate font-display text-xs uppercase tracking-wider">{label}</span>
          {isActive && <ChevronRight className="h-3.5 w-3.5 text-sidebar-accent-foreground" />}
        </>
      )}
    </NavLink>
  );
}
