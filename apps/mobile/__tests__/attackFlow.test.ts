import {
  canSubmitAttack,
  formatRunningLogDate,
  formatRunningLogDistance,
  formatRunningLogLabel,
  getAttackCharacters,
} from '../src/utils/attackFlow';
import type { Character } from '../src/store/characterStore';

const makeCharacter = (
  id: number,
  type: Character['type'],
): Character => ({
  id,
  characterId: id + 100,
  name: `character-${id}`,
  grade: 'common',
  type,
  attackLv: 1,
  defenseLv: 1,
  speedLv: 1,
  pointLv: 1,
  isDeployed: false,
  deployedTerritoryId: null,
});

describe('attackFlow', () => {
  it('filters attack type characters only', () => {
    const characters = [
      makeCharacter(1, 'attack'),
      makeCharacter(2, 'defense'),
      makeCharacter(3, 'buff'),
      makeCharacter(4, 'attack'),
    ];

    expect(getAttackCharacters(characters).map((character) => character.id)).toEqual([
      1,
      4,
    ]);
  });

  it('formats running log distance for meter and kilometer ranges', () => {
    expect(formatRunningLogDistance(0.42)).toBe('420m');
    expect(formatRunningLogDistance(3.456)).toBe('3.46km');
  });

  it('builds a running log label with date and distance', () => {
    const label = formatRunningLogLabel({
      id: 1,
      distanceKm: 1.25,
      earnedPoints: 30,
      avgPace: 6.2,
      areaSqm: 0,
      startedAt: '2026-05-28T09:10:00.000Z',
      endedAt: null,
    });

    expect(label).toContain('1.25km');
  });

  it('keeps invalid running log date text as-is', () => {
    expect(formatRunningLogDate('invalid-date')).toBe('invalid-date');
  });

  it('allows attack submit only when both selections exist', () => {
    expect(canSubmitAttack(1, 2)).toBe(true);
    expect(canSubmitAttack(null, 2)).toBe(false);
    expect(canSubmitAttack(1, null)).toBe(false);
  });
});
