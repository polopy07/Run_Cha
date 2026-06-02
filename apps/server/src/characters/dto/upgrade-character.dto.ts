import { IsIn } from 'class-validator';

export type UpgradeStat = 'attack' | 'defense';

export class UpgradeCharacterDto {
  @IsIn(['attack', 'defense'])
  stat: UpgradeStat;
}
