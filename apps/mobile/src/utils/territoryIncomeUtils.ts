import type { Character } from '../store/characterStore';
import type { TerritoryDeployedCharacter } from '../api/territory';

type IncomeCharacter =
  | Pick<Character, 'type' | 'pointLv' | 'basePointRate'>
  | Pick<TerritoryDeployedCharacter, 'type' | 'pointLv' | 'basePointRate'>
  | null
  | undefined;

const SQM_PER_POINT = 1000;
const POINT_EFFICIENCY_LEVEL_BONUS = 0.05;
const POINT_EFFICIENCY_MULTIPLIER_CAP = 2;

export function getEffectiveTerritoryAreaSqm(
  areaSqm: number,
  occupationRate: number,
) {
  return areaSqm * (occupationRate / 100);
}

export function getTerritoryBaseHourlyIncome(
  areaSqm: number,
  occupationRate: number,
) {
  return getEffectiveTerritoryAreaSqm(areaSqm, occupationRate) / SQM_PER_POINT;
}

export function getTerritoryBuffMultiplier(character: IncomeCharacter) {
  if (!character || character.type !== 'buff') {
    return 1;
  }

  const multiplier =
    character.basePointRate +
    Math.max(character.pointLv - 1, 0) * POINT_EFFICIENCY_LEVEL_BONUS;

  return Math.min(multiplier, POINT_EFFICIENCY_MULTIPLIER_CAP);
}

export function getEstimatedTerritoryHourlyIncome(
  areaSqm: number,
  occupationRate: number,
  character?: IncomeCharacter,
) {
  const baseIncome = getTerritoryBaseHourlyIncome(areaSqm, occupationRate);
  const multiplier = getTerritoryBuffMultiplier(character);
  const rawIncome = baseIncome * multiplier;

  return {
    baseIncome,
    multiplier,
    rawIncome,
    estimatedPoints: Math.floor(rawIncome),
  };
}
