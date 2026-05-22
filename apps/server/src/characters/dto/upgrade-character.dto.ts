import { IsIn } from 'class-validator';

export type UpgradeStat = 'attack' | 'defense' | 'speed' | 'point';

export class UpgradeCharacterDto {
  @IsIn(['attack', 'defense', 'speed', 'point'])
  stat: UpgradeStat;
}
