import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

// How long the expand controls keep drawing attention after a collapse.
const EXPAND_HINT_MS = 5000;

export function AppLayout() {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandHint, setExpandHint] = useState(false);

  const collapseSidebar = useCallback(() => {
    setDesktopSidebarOpen(false);
    setExpandHint(true);
  }, []);

  const expandSidebar = useCallback(() => {
    setDesktopSidebarOpen(true);
    setExpandHint(false);
  }, []);

  useEffect(() => {
    if (!expandHint) return undefined;
    const timer = setTimeout(() => setExpandHint(false), EXPAND_HINT_MS);
    return () => clearTimeout(timer);
  }, [expandHint]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key?.toLowerCase() !== 'b' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      event.preventDefault();
      if (desktopSidebarOpen) collapseSidebar();
      else expandSidebar();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desktopSidebarOpen, collapseSidebar, expandSidebar]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        desktopOpen={desktopSidebarOpen}
        onCollapse={collapseSidebar}
        onExpand={expandSidebar}
        showExpandHint={expandHint}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          desktopSidebarOpen={desktopSidebarOpen}
          onExpandSidebar={expandSidebar}
          showExpandHint={expandHint}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
