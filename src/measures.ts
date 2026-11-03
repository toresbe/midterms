import { STATE_NAME } from './data';
import SNAPSHOT from './measures.json';

const STATE_ABBR = Object.fromEntries(Object.entries(STATE_NAME).map(([abbr, name]) => [name, abbr]));
const SUMMARIES: Record<string, { original: string; nb: string }> = SNAPSHOT.summaries;

export interface Measure {
  id: string;
  state: string;
  title: string;
  category: string;
  summary: string;
}

/** core.json: ID|unused|State|Title|Type|Category|Description|Yes|No. */
export function parseMeasures(core: { meas?: string }): Measure[] {
  return (core.meas ?? '').split('\n').flatMap((line) => {
    const [id, , stateName, title, , category, description] = line.split('|');
    const state = STATE_ABBR[stateName];
    if (!id || !state || !title || !description) return [];
    // Only reuse a translation while the source text still matches.
    const translated = SUMMARIES[id];
    return [{ id, state, title, category, summary: translated?.original === description ? translated.nb : description }];
  });
}

const CATEGORY: Record<string, string> = {
  'Elections & voting': 'Valg og stemmerett', 'Government & courts': 'Styresett og domstoler',
  Education: 'Utdanning', Firearms: 'Våpen', 'Labor & economy': 'Arbeid og økonomi',
  'Bonds & spending': 'Lån og offentlige utgifter', Taxes: 'Skatt', 'Civil rights': 'Borgerrettigheter',
  'Criminal justice': 'Strafferett', 'LGBTQ & gender': 'Kjønn og LHBT+', Housing: 'Bolig',
  Health: 'Helse', 'Environment & natural resources': 'Miljø og naturressurser',
  'Abortion & reproductive rights': 'Abort og reproduktive rettigheter', Gambling: 'Pengespill', Other: 'Annet',
};
export const measureCategory = (category: string) => CATEGORY[category] ?? category;
