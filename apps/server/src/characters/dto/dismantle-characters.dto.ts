import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DISMANTLE_MAX_COUNT = 10;

export class DismantleCharactersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(DISMANTLE_MAX_COUNT)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  userCharacterIds: number[];
}
