import { IsIn } from 'class-validator';

export class DrawGachaDto {
  @IsIn([1, 10])
  count: 1 | 10;
}
