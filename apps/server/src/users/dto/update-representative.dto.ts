import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateRepresentativeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  userCharacterId: number | null;
}
