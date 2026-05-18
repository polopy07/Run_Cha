import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';

class CoordDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class FinishRunningDto {
  @IsArray()
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
