import { useQuery } from '@tanstack/react-query';
import { ensureLiveNames } from '@/services/namesService';
import { getAssociateLabelByEmail } from '@/utils/dealMeta';
import { getNameRevision } from '@/utils/nameRegistry';

export const NAMES_QUERY_KEY = ['names'];

/**
 * The name registry is a plain module-level store, so a component reading it
 * has nothing to re-render on once the roster arrives. Subscribing to the load
 * through React Query supplies that: the component re-renders when the query
 * resolves, and any label it derives is recomputed with the roster in place.
 *
 * Services don't need this -- they await ensureLiveNames() directly before
 * normalizing rows. It exists for the components that resolve a name during
 * render instead.
 */
function useNamesLoaded() {
  useQuery({
    queryKey: NAMES_QUERY_KEY,
    queryFn: async () => {
      await ensureLiveNames();
      return getNameRevision();
    },
    staleTime: Infinity,
  });
}

/** The signed-in user's display name. Falls back to their address while the
 * roster loads, and for anyone signing in without a Bitrix account. */
export function useAssociateLabelByEmail(email) {
  useNamesLoaded();
  // Deliberately not memoized: this is a single Map hit, and a memo keyed on
  // the registry's revision would be a dependency the linter can't see.
  return getAssociateLabelByEmail(email);
}
