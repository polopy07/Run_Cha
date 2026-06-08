import type { Character } from '../store/characterStore';
import type { RunningLogSummary } from '../api/running';

export type AttackCharacterSortMode = 'recent' | 'grade' | 'attack';

export const ATTACK_CHARACTER_SORT_OPTIONS: {
  label: string;
  value: AttackCharacterSortMode;
}[] = [
  { label: '최근', value: 'recent' },
  { label: '등급', value: 'grade' },
  { label: '공격력', value: 'attack' },
];

const GRADE_ORDER: Record<Character['grade'], number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

export function getAttackCharacters(characters: Character[]) {
  return characters.filter((character) => character.type === 'attack');
}

export function getSortedAttackCharacters(
  characters: Character[],
  sortMode: AttackCharacterSortMode,
) {
  return [...getAttackCharacters(characters)].sort((a, b) => {
    if (sortMode === 'grade') {
      return (
        GRADE_ORDER[b.grade] - GRADE_ORDER[a.grade] ||
        b.attackLv - a.attackLv ||
        b.id - a.id
      );
    }

    if (sortMode === 'attack') {
      return (
        b.attackLv - a.attackLv ||
        GRADE_ORDER[b.grade] - GRADE_ORDER[a.grade] ||
        b.id - a.id
      );
    }

    return b.id - a.id;
  });
}

export function resolveSelectedAttackCharacterId(
  attackCharacters: Character[],
  selectedCharacterId: number | null,
) {
  if (
    selectedCharacterId !== null &&
    attackCharacters.some((character) => character.id === selectedCharacterId)
  ) {
    return selectedCharacterId;
  }

  return attackCharacters[0]?.id ?? null;
}

export function formatRunningLogDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  return `${distanceKm.toFixed(2)}km`;
}

export function formatRunningLogDate(startedAt: string) {
  const date = new Date(startedAt);

  if (Number.isNaN(date.getTime())) {
    return startedAt;
  }

  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRunningLogLabel(log: RunningLogSummary) {
  return `${formatRunningLogDate(log.startedAt)} · ${formatRunningLogDistance(
    log.distanceKm,
  )}`;
}

export function formatAttackAvailableAt(value: string | null) {
  if (!value) {
    return '바로 가능';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function canSubmitAttack(
  selectedRunningLogId: number | null,
  selectedCharacterId: number | null,
) {
  return selectedRunningLogId !== null && selectedCharacterId !== null;
}
