import type { Character } from '../store/characterStore';
import type { RunningLogSummary } from '../api/running';

export function getAttackCharacters(characters: Character[]) {
  return characters.filter((character) => character.type === 'attack');
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

export function canSubmitAttack(
  selectedRunningLogId: number | null,
  selectedCharacterId: number | null,
) {
  return selectedRunningLogId !== null && selectedCharacterId !== null;
}
