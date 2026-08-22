import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;
}

export class MoveStatusDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}
