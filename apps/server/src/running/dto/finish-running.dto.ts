import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
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
}
