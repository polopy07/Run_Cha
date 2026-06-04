import { IsDefined, IsInt, IsNull, Min, ValidateIf } from 'class-validator';

export class UpdateRepresentativeDto {
  @IsDefined()
  @ValidateIf((o) => o.userCharacterId !== null)
  @IsInt()
  @Min(1)
  userCharacterId: number | null;
}
