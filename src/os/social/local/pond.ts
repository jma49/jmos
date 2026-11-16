// The pond's endings in this browser: the stand-in knows one visitor, so
// the count is 1 once they have reached the end and 0 until then.

import { loadJSON, saveJSON } from '../../core/storage';
import type { PondSocial } from '../pond';

const ENDING_KEY = 'os-dev-pond-ending';

export function localPond(): PondSocial {
  return {
    async pondEndings() {
      return loadJSON<boolean>(ENDING_KEY, false) ? 1 : 0;
    },

    async reachPondEnding() {
      saveJSON(ENDING_KEY, true);
      return true;
    }
  };
}
