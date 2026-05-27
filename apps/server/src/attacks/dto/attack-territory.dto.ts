import { IsInt, Min } from 'class-validator';

export class AttackTerritoryDto {
  @IsInt()
  @Min(1)
  runningLogId: number;

  @IsInt()
  @Min(1)
  attackerCharacterId: number;
}
