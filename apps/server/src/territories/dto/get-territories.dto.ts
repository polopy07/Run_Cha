import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GetTerritoriesDto {
  @Type(() => Number)
  @IsNumber()
  minLat: number;

  @Type(() => Number)
  @IsNumber()
  maxLat: number;

  @Type(() => Number)
  @IsNumber()
  minLng: number;

  @Type(() => Number)
  @IsNumber()
  maxLng: number;
}
