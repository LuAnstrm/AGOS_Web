import { AlertTier as T } from '../database/enums';
import { renderMessages } from './messages';

describe('alert messages', () => {
  it('fills place, depth and rising in both languages', () => {
    const m = renderMessages({
      tier: T.CRITICAL,
      previousTier: T.WARNING,
      place: 'Caingin canal, Caingin',
      depthCm: 187.4,
      rising: true,
    });
    expect(m.en).toBe(
      'CRITICAL: Severe flooding at Caingin canal, Caingin (187 cm), still rising. Evacuate now to higher ground.',
    );
    expect(m.fil).toContain(
      'Caingin canal, Caingin (187 cm) at patuloy na tumataas',
    );
  });

  it('prefixes a receding note when stepping down (not for Safe)', () => {
    const down = renderMessages({
      tier: T.WATCH,
      previousTier: T.WARNING,
      place: 'X',
      depthCm: 60,
      rising: false,
    });
    expect(down.en.startsWith('Water is receding. WATCH')).toBe(true);
    expect(down.fil.startsWith('Bumababa na ang tubig. BANTAY')).toBe(true);
    const safe = renderMessages({
      tier: T.SAFE,
      previousTier: T.WATCH,
      place: 'X',
      depthCm: 20,
      rising: false,
    });
    expect(safe.en.startsWith('SAFE')).toBe(true);
  });

  it('leaves no unfilled placeholders for any tier', () => {
    for (const tier of Object.values(T)) {
      const m = renderMessages({
        tier,
        previousTier: null,
        place: 'X',
        depthCm: 1,
        rising: false,
      });
      expect(m.en + m.fil).not.toMatch(/[{}]/);
    }
  });
});
