import { IsDefined, IsInt, Min, ValidateIf } from 'class-validator';

export class UpdateRepresentativeDto {
  @IsDefined()
  @ValidateIf((o: UpdateRepresentativeDto) => o.userCharacterId !== null)
  @IsInt()
  @Min(1)
  userCharacterId: number | null;
}
