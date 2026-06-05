import { CharacterGrade } from './entities/character.entity';

const MAX_LEVEL_BY_GRADE: Record<CharacterGrade, number> = {
  [CharacterGrade.COMMON]: 10,
  [CharacterGrade.RARE]: 15,
  [CharacterGrade.EPIC]: 20,
  [CharacterGrade.LEGENDARY]: 30,
};

export const CHARACTER_EXP_BASE = 100;
export const CHARACTER_EXP_LEVEL_STEP = 50;

export function getCharacterMaxLevel(grade: CharacterGrade) {
  return MAX_LEVEL_BY_GRADE[grade];
}

// Current balance intentionally keeps primary stat caps aligned with character level caps.
export function getCharacterStatMaxLevel(grade: CharacterGrade) {
  return MAX_LEVEL_BY_GRADE[grade];
}

export function getCharacterNextLevelExperience(level: number) {
  return CHARACTER_EXP_BASE + (level - 1) * CHARACTER_EXP_LEVEL_STEP;
}
