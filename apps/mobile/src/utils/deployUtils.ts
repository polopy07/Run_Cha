import type { Character } from '../store/characterStore';

export type DeploySortMode = 'recent' | 'grade' | 'type';

export const DEPLOY_SORT_OPTIONS: { value: DeploySortMode; label: string }[] = [
  { value: 'recent', label: '최근' },
  { value: 'grade', label: '등급' },
  { value: 'type', label: '타입' },
];

export const DEPLOY_TYPE_FILTER_OPTIONS: {
  value: Extract<Character['type'], 'defense' | 'buff'>;
  label: string;
}[] = [
  { value: 'defense', label: '수비형' },
  { value: 'buff', label: '버프형' },
];

export const GRADE_ORDER: Record<Character['grade'], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

export const TYPE_ORDER: Record<Character['type'], number> = {
  attack: 3,
  defense: 2,
  buff: 1,
};

export function canDeployCharacter(character: Character) {
  return character.type === 'defense' || character.type === 'buff';
}
