import { IsIn } from 'class-validator';

export type UpgradeStat = 'attack' | 'defense' | 'point';

export class UpgradeCharacterDto {
  @IsIn(['attack', 'defense', 'point'])
  stat: UpgradeStat;
}
