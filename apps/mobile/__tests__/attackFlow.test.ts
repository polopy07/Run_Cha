import {
  formatAttackAvailableAt,
  canSubmitAttack,
  formatRunningLogDate,
  formatRunningLogDistance,
  formatRunningLogLabel,
  getAttackCharacters,
  getSortedAttackCharacters,
  resolveSelectedAttackCharacterId,
} from '../src/utils/attackFlow';
import type { Character } from '../src/store/characterStore';

const makeCharacter = (
  id: number,
  type: Character['type'],
  overrides: Partial<Character> = {},
): Character => ({
  id,
  characterId: id + 100,
  name: `character-${id}`,
  grade: 'common',
  type,
  basePointRate: 1,
  attackLv: 1,
  defenseLv: 1,
  pointLv: 1,
  level: 1,
  experience: 0,
  nextLevelExperience: 100,
  isDeployed: false,
  deployedTerritoryId: null,
  ...overrides,
});

describe('attackFlow', () => {
  it('filters attack type characters only', () => {
    const characters = [
      makeCharacter(1, 'attack'),
      makeCharacter(2, 'defense'),
      makeCharacter(3, 'buff'),
      makeCharacter(4, 'attack'),
    ];

    expect(
      getAttackCharacters(characters).map(character => character.id),
    ).toEqual([1, 4]);
  });

  it('formats running log distance for meter and kilometer ranges', () => {
    expect(formatRunningLogDistance(0.42)).toBe('420m');
    expect(formatRunningLogDistance(3.456)).toBe('3.46km');
  });

  it('sorts attack characters by recent id, grade, and attack stat', () => {
    const characters = [
      makeCharacter(1, 'attack', { grade: 'common', attackLv: 5 }),
      makeCharacter(2, 'defense', { grade: 'legendary', attackLv: 99 }),
      makeCharacter(3, 'attack', { grade: 'rare', attackLv: 2 }),
      makeCharacter(4, 'attack', { grade: 'epic', attackLv: 4 }),
    ];

    expect(
      getSortedAttackCharacters(characters, 'recent').map(character => character.id),
    ).toEqual([4, 3, 1]);
    expect(
      getSortedAttackCharacters(characters, 'grade').map(character => character.id),
    ).toEqual([4, 3, 1]);
    expect(
      getSortedAttackCharacters(characters, 'attack').map(character => character.id),
    ).toEqual([1, 4, 3]);
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

  it('formats next attack available time fallback', () => {
    expect(formatAttackAvailableAt(null)).toBe('바로 가능');
    expect(formatAttackAvailableAt('invalid-date')).toBe('invalid-date');
  });

  it('allows attack submit only when both selections exist', () => {
    expect(canSubmitAttack(1, 2)).toBe(true);
    expect(canSubmitAttack(null, 2)).toBe(false);
    expect(canSubmitAttack(1, null)).toBe(false);
  });

  it('keeps selected attack character when it still exists', () => {
    const characters = [makeCharacter(1, 'attack'), makeCharacter(2, 'attack')];

    expect(resolveSelectedAttackCharacterId(characters, 2)).toBe(2);
  });

  it('falls back to first attack character when selected one disappears', () => {
    const characters = [makeCharacter(1, 'attack'), makeCharacter(2, 'attack')];

    expect(resolveSelectedAttackCharacterId(characters, 3)).toBe(1);
  });

  it('clears selected attack character when no attack character exists', () => {
    expect(resolveSelectedAttackCharacterId([], 3)).toBeNull();
  });
});
