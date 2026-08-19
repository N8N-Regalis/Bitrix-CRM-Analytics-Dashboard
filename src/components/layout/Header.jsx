import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogOut, Menu, PanelLeft, Search, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { SyncStatus } from '@/components/layout/SyncStatus';
import { NAV_ITEMS } from '@/components/layout/Navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { useDealsQuery } from '@/hooks/useDeals';
import { useAssociateLabelByEmail } from '@/hooks/useNames';
import { formatInitials } from '@/utils/format';
import { cn } from '@/utils/cn';

const MAX_RESULTS_PER_GROUP = 5;

function useBreadcrumb() {
  const { pathname } = useLocation();
  return useMemo(() => {
    const match = NAV_ITEMS.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
    return match?.label ?? 'Dashboard';
  }, [pathname]);
}

function useSearchResults(query, deals) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { deals: [], associates: [] };

    const dealMatches = [];
    const associateMap = new Map();

    for (const deal of deals) {
      if (dealMatches.length < MAX_RESULTS_PER_GROUP && (deal.title?.toLowerCase().includes(q) || String(deal.id).includes(q))) {
        dealMatches.push(deal);
      }
      if (
        associateMap.size < MAX_RESULTS_PER_GROUP &&
        deal.ownerId !== null &&
        !associateMap.has(deal.ownerId) &&
        deal.ownerLabel?.toLowerCase().includes(q)
      ) {
        associateMap.set(deal.ownerId, deal.ownerLabel);
      }
    }

    return {
      deals: dealMatches,
      associates: [...associateMap.entries()].map(([ownerId, label]) => ({ ownerId, label })),
    };
  }, [query, deals]);
}

export function Header({ desktopSidebarOpen, onExpandSidebar, showExpandHint, onOpenMobileNav }) {
  const currentPage = useBreadcrumb();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const associateLabel = useAssociateLabelByEmail(user?.email);
  const { data: deals = [] } = useDealsQuery();
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  const results = useSearchResults(searchValue, deals);
  const hasResults = results.deals.length > 0 || results.associates.length > 0;

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goToDeal(deal) {
    navigate(`/deals?q=${encodeURIComponent(deal.title)}`);
    setSearchValue('');
    setIsOpen(false);
  }

  function goToAssociate(associate) {
    navigate(`/deals?owner=${encodeURIComponent(associate.ownerId)}`);
    setSearchValue('');
    setIsOpen(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!searchValue.trim()) return;
    navigate(`/deals?q=${encodeURIComponent(searchValue.trim())}`);
    setIsOpen(false);
  }

  function handleSignOut() {
    signOut();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
      <button
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {!desktopSidebarOpen && (
        <button
          onClick={onExpandSidebar}
          aria-label="Expand sidebar"
          title="Expand sidebar (Ctrl+B)"
          className={cn(
            'hidden h-9 shrink-0 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2.5',
            'text-sm font-medium text-primary transition-colors hover:bg-primary/20 md:flex',
            showExpandHint && 'animate-attention-ring'
          )}
        >
          <PanelLeft className="h-4 w-4" />
          <span className="hidden lg:inline">Menu</span>
        </button>
      )}

      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden text-muted-foreground sm:inline">Regalis CRM</span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="truncate font-medium text-foreground">{currentPage}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div ref={searchRef} className="relative hidden md:block">
          <form onSubmit={handleSubmit}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              type="search"
              placeholder="Search deals, ID, associates..."
              className={cn(
                'h-9 w-56 rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground',
                'transition-all focus:w-72 focus:outline-none focus:ring-2 focus:ring-ring'
              )}
            />
          </form>

          {isOpen && searchValue.trim() && (
            <div className="absolute right-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {hasResults ? (
                <div className="max-h-80 overflow-y-auto py-1">
                  {results.deals.length > 0 && (
                    <div>
                      <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Deals</p>
                      {results.deals.map((deal) => (
                        <button
                          key={deal.id}
                          type="button"
                          onClick={() => goToDeal(deal)}
                          className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate text-foreground">{deal.title}</span>
                          <span className="text-xs text-muted-foreground">{deal.stageLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.associates.length > 0 && (
                    <div>
                      <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Associates
                      </p>
                      {results.associates.map((associate) => (
                        <button
                          key={associate.ownerId}
                          type="button"
                          onClick={() => goToAssociate(associate)}
                          className="flex w-full items-center px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                        >
                          {associate.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches for &ldquo;{searchValue}&rdquo;</p>
              )}
            </div>
          )}
        </div>

        <SyncStatus />

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full transition-opacity hover:opacity-80" aria-label="Account menu">
              <Avatar>
                {user?.picture && <AvatarImage src={user.picture} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback>
                  {formatInitials(user?.name) || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate font-semibold text-foreground">{associateLabel}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
