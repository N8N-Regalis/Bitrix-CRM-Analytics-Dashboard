import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Building2 } from 'lucide-react';
import { NAV_ITEMS, NavItem } from '@/components/layout/Navigation';
import { SidebarProfileCard } from '@/components/layout/ProfileCard';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/utils/cn';

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-6 py-5 border-b border-sidebar-border">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Building2 className="h-4 w-4 text-primary-foreground" />
      </div>
      <div>
        <p className="font-display text-sm font-bold uppercase leading-tight tracking-wide text-sidebar-foreground">
          Regalis CRM
        </p>
        <p className="glow-text text-xs font-medium uppercase">Analytics</p>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavItem key={item.to} {...item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border px-4 py-3">
      <p className="text-center text-xs text-sidebar-foreground/40">
        Built by <span className="glow-text font-bold uppercase">Automations Team</span>
      </p>
    </div>
  );
}

/**
 * Pull-out tab pinned to the left edge while the sidebar is collapsed. It sits at the
 * same height as the collapse tab so the control stays where the user left it.
 */
function ExpandHandle({ onExpand, showHint }) {
  return (
    <button
      onClick={onExpand}
      aria-label="Expand sidebar"
      title="Expand sidebar (Ctrl+B)"
      className={cn(
        'group fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-r-xl',
        'bg-primary py-3.5 pl-1 pr-1.5 text-primary-foreground shadow-lg ring-1 ring-primary/40',
        'transition-all duration-200 hover:bg-primary/90 hover:pr-2.5 hover:shadow-xl md:flex',
        showHint && 'animate-attention-ring'
      )}
    >
      <ChevronRight
        className={cn(
          'h-4 w-4 transition-transform group-hover:translate-x-0.5',
          showHint && 'animate-nudge-x'
        )}
      />
      <span className="text-[10px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl]">Menu</span>
    </button>
  );
}

export function Sidebar({ desktopOpen, onCollapse, onExpand, showExpandHint, mobileOpen, onMobileOpenChange }) {
  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside
        className={cn(
          'relative hidden h-full flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 md:flex',
          desktopOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        {desktopOpen && (
          <button
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+B)"
            className="absolute -right-3 top-1/2 z-10 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <BrandMark />
        <SidebarNav />
        <SidebarProfileCard />
        <SidebarFooter />
      </aside>

      {!desktopOpen && <ExpandHandle onExpand={onExpand} showHint={showExpandHint} />}

      {/* Mobile overlay drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="flex flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <BrandMark />
          <SidebarNav onNavigate={() => onMobileOpenChange(false)} />
          <SidebarProfileCard />
          <SidebarFooter />
        </SheetContent>
      </Sheet>
    </>
  );
}
