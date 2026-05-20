import { IsInt, ValidateIf } from 'class-validator';

export class DeployCharacterDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  territory_id: number | null;
}
