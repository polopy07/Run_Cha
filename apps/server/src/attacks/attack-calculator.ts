import { Character } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { Territory } from '../territories/entities/territory.entity';

const LEVEL_STAT_BONUS = 5;

type AttackerCharacter = Pick<UserCharacter, 'attack_lv'> & {
  character: Pick<Character, 'base_attack'>;
};

type DefenderCharacter = Pick<UserCharacter, 'defense_lv'> & {
  character: Pick<Character, 'base_defense'>;
};

type AttackTargetTerritory = Pick<Territory, 'area_sqm' | 'occupation_rate'>;

export type AttackCalculationInput = {
  attackerCharacter: AttackerCharacter;
  deployedDefenders?: DefenderCharacter[] | null;
  territory: AttackTargetTerritory;
};

export type AttackCalculationResult = {
  attackPower: number;
  defensePower: number;
  defenseWithRate: number;
  rawDamage: number;
  damage: number;
  occupationRateBefore: number;
  occupationRateAfter: number;
  acquiredAreaSqm: number;
  success: boolean;
};

export function calculateAttackPower(
  attackerCharacter: AttackerCharacter,
): number {
  return (
    attackerCharacter.character.base_attack +
    (normalizeLevel(attackerCharacter.attack_lv) - 1) * LEVEL_STAT_BONUS
  );
}

export function calculateDefensePower(
  deployedDefenders?: DefenderCharacter[] | null,
): number {
  if (!deployedDefenders) return 0;

  return deployedDefenders.reduce(
    (sum, defender) =>
      sum +
      defender.character.base_defense +
      (normalizeLevel(defender.defense_lv) - 1) * LEVEL_STAT_BONUS,
    0,
  );
}

export function calculateDefenseWithRate(
  defensePower: number,
  occupationRate: number,
): number {
  return defensePower * (occupationRate / 100);
}

export function calculateRawDamage(
  attackPower: number,
  defenseWithRate: number,
): number {
  return Math.max(0, attackPower - defenseWithRate);
}

export function calculateDamage(rawDamage: number): number {
  return Math.floor(rawDamage);
}

export function calculateOccupationRateAfter(
  occupationRateBefore: number,
  damage: number,
): number {
  return normalizeOccupationRate(occupationRateBefore - damage);
}

export function calculateAcquiredAreaSqm(
  areaSqm: number,
  occupationRateBefore: number,
  occupationRateAfter: number,
): number {
  return (areaSqm * (occupationRateBefore - occupationRateAfter)) / 100;
}

export function calculateAttackOutcome({
  attackerCharacter,
  deployedDefenders,
  territory,
}: AttackCalculationInput): AttackCalculationResult {
  const occupationRateBefore = normalizeOccupationRate(
    territory.occupation_rate,
  );
  const attackPower = calculateAttackPower(attackerCharacter);
  const defensePower = calculateDefensePower(deployedDefenders);
  const defenseWithRate = calculateDefenseWithRate(
    defensePower,
    occupationRateBefore,
  );
  const rawDamage = calculateRawDamage(attackPower, defenseWithRate);
  const damage = calculateDamage(rawDamage);
  const occupationRateAfter = calculateOccupationRateAfter(
    occupationRateBefore,
    damage,
  );
  const acquiredAreaSqm = calculateAcquiredAreaSqm(
    territory.area_sqm,
    occupationRateBefore,
    occupationRateAfter,
  );

  return {
    attackPower,
    defensePower,
    defenseWithRate,
    rawDamage,
    damage,
    occupationRateBefore,
    occupationRateAfter,
    acquiredAreaSqm,
    success: occupationRateAfter < occupationRateBefore,
  };
}

function normalizeLevel(level: number): number {
  return Math.max(1, level);
}

function normalizeOccupationRate(rate: number): number {
  return Math.min(100, Math.max(0, rate));
}
