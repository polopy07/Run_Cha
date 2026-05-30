import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTerritoryNameDto {
  @IsOptional()
  @ValidateIf((o: UpdateTerritoryNameDto) => o.name !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string | null;
}
