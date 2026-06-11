// Sync constants with apps/server/src/running/running.service.ts
const DISTANCE_POINT_RATE = 100;
const DISTANCE_BONUS_BASE = 1.1;
const DISTANCE_BONUS_CAP = 3.0;
const MIN_VALID_SPEED_KMH = 4;
const MAX_VALID_SPEED_KMH = 20;

function getPaceMultiplier(avgPaceMinPerKm: number): number {
  if (avgPaceMinPerKm < 3) return 0;
  if (avgPaceMinPerKm <= 4) return 1.2;
  if (avgPaceMinPerKm <= 5) return 1.0;
  if (avgPaceMinPerKm <= 7) return 0.8;
  if (avgPaceMinPerKm <= 8) return 0.6;
  return 0;
}

/**
 * 러닝 중 예상 포인트 실시간 계산.
 * 폐곡선 보너스(×1.3)는 완료 시점까지 알 수 없어 미적용.
 */
export function estimateRunningPoints(distanceM: number, elapsedSec: number): number {
  if (distanceM < 10 || elapsedSec <= 0) return 0;

  const distanceKm = distanceM / 1000;
  const speedKmh = distanceKm / (elapsedSec / 3600);

  if (speedKmh < MIN_VALID_SPEED_KMH || speedKmh > MAX_VALID_SPEED_KMH) return 0;

  const avgPaceMinPerKm = elapsedSec / 60 / distanceKm;
  const paceMultiplier = getPaceMultiplier(avgPaceMinPerKm);
  const distanceMultiplier = Math.min(
    Math.pow(DISTANCE_BONUS_BASE, distanceKm),
    DISTANCE_BONUS_CAP,
  );

  return Math.floor(distanceKm * DISTANCE_POINT_RATE * paceMultiplier * distanceMultiplier);
}
