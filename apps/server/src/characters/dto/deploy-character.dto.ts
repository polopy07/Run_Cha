import { IsDefined, IsInt, ValidateIf } from 'class-validator';

export class DeployCharacterDto {
  @IsDefined({
    message: 'territory_id 필드는 필수입니다. 회수하려면 null을 전달하세요.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  territory_id: number | null;
}
