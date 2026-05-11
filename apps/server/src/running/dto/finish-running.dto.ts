import { Type } from 'class-transformer';
import { IsArray, IsNumber, ValidateNested } from 'class-validator';

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

  @IsNumber()
  distance_km: number;

  @IsNumber()
  avg_pace: number;
}
