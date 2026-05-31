import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class CoordDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

export class FinishRunningDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CoordDto)
  path: CoordDto[];

  @IsOptional()
  @IsNumber()
  @IsPositive()
  distance_km?: number;

  @IsDateString()
  started_at: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  territory_name?: string;
}
