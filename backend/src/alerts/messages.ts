import { AlertTier } from '../database/enums';
import { rank } from './alert-policy';

/**
 * Bilingual (English / Filipino) alert text.
 *
 * DRAFT WORDING — have the Filipino reviewed by a native speaker and aligned
 * with Malolos CDRRMO's own advisory phrasing before the pilot. Keep messages
 * short: they are also the push-notification body on low-end phones.
 */

export interface MessageContext {
  tier: AlertTier;
  previousTier: AlertTier | null;
  /** Human place name, e.g. "Caingin drainage canal, Caingin". */
  place: string;
  depthCm: number;
  rising: boolean;
}

const TEXT: Record<AlertTier, { en: string; fil: string }> = {
  [AlertTier.SAFE]: {
    en: 'SAFE: Water level at {place} is back to normal ({d} cm).',
    fil: 'LIGTAS: Normal na ang antas ng tubig sa {place} ({d} cm).',
  },
  [AlertTier.ADVISORY]: {
    en: 'ADVISORY: Water is rising at {place} ({d} cm). Stay alert for updates.',
    fil: 'ABISO: Tumataas ang tubig sa {place} ({d} cm). Maging alerto sa mga susunod na abiso.',
  },
  [AlertTier.WATCH]: {
    en: 'WATCH: Flooding at {place} ({d} cm). Prepare your emergency kit and monitor announcements.',
    fil: 'BANTAY: May baha sa {place} ({d} cm). Ihanda ang emergency kit at subaybayan ang mga anunsyo.',
  },
  [AlertTier.WARNING]: {
    en: 'WARNING: Dangerous flooding at {place} ({d} cm). Be ready to evacuate; follow your barangay and DRRMO.',
    fil: 'BABALA: Mapanganib na baha sa {place} ({d} cm). Maghanda sa paglikas; sundin ang inyong barangay at DRRMO.',
  },
  [AlertTier.CRITICAL]: {
    en: 'CRITICAL: Severe flooding at {place} ({d} cm){rising}. Evacuate now to higher ground.',
    fil: 'KRITIKAL: Matinding baha sa {place} ({d} cm){rising}. Lumikas na agad sa mataas na lugar.',
  },
};

const RISING = { en: ', still rising', fil: ' at patuloy na tumataas' };
const RECEDING = { en: 'Water is receding. ', fil: 'Bumababa na ang tubig. ' };

export function renderMessages(ctx: MessageContext): {
  en: string;
  fil: string;
} {
  const t = TEXT[ctx.tier];
  const d = String(Math.round(ctx.depthCm));
  const receding =
    ctx.previousTier != null &&
    rank(ctx.tier) < rank(ctx.previousTier) &&
    ctx.tier !== AlertTier.SAFE;
  const fill = (s: string, lang: 'en' | 'fil') =>
    (receding ? RECEDING[lang] : '') +
    s
      .replace('{place}', ctx.place)
      .replace('{d}', d)
      .replace('{rising}', ctx.rising ? RISING[lang] : '');
  return { en: fill(t.en, 'en'), fil: fill(t.fil, 'fil') };
}
