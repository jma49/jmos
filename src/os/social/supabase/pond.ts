// The count of visitors who reached the pond's third ending
// (public.pond_endings). The database tells visitors apart (a salted hash
// of the address, written by a trigger) and counts each once; the site
// reads how many rows there are and asks for its own.

import { report } from '../../core/report';
import type { PondSocial } from '../pond';
import type { SupabaseContext } from './context';

export function supabasePond({ client }: SupabaseContext): PondSocial {
  return {
    async pondEndings() {
      try {
        // Only the count: `reached_at` is the one column visitors may read, and no row is fetched.
        const { count, error } = await client.from('pond_endings').select('reached_at', { count: 'exact', head: true });
        if (error) throw error;
        return count ?? 0;
      } catch (error) {
        report(error, 'pond.endings');
        return 0;
      }
    },

    async reachPondEnding() {
      try {
        // The trigger writes the row itself and throws `visitor` away; an
        // insert has to name a column. For a visitor counted already it
        // adds nothing and answers the same, so there is no duplicate to handle.
        const { error } = await client.from('pond_endings').insert({ visitor: '' });
        if (!error) return true;
        // P0429 is the hourly limit on new visitors, which is expected: the pond asks again later.
        if (error.code !== 'P0429') report(error, 'pond.reach');
        return false;
      } catch (error) {
        report(error, 'pond.reach');
        return false;
      }
    }
  };
}
