import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/components/layout/AuthProvider';
import { getAssociateLabelByEmail } from '@/utils/associateEmails';
import { formatInitials } from '@/utils/format';

// Backs the sidebar footer, so the signed-in identity is described in
// exactly one place.
function useProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  }

  return { user, associateLabel: getAssociateLabelByEmail(user?.email), handleSignOut };
}

function ProfileAvatar({ user, className }) {
  return (
    <Avatar className={className}>
      {user?.picture && <AvatarImage src={user.picture} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="text-sm">
        {formatInitials(user?.name) || <User className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );
}

export function SidebarProfileCard() {
  const { user, associateLabel, handleSignOut } = useProfile();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border px-3 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5">
        <ProfileAvatar user={user} className="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{associateLabel}</p>
          <p className="truncate text-xs text-sidebar-foreground/50">{user.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
