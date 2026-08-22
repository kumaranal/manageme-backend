import { IsDateString, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateSprintDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class UpdateSprintLengthDto {
  @IsInt()
  @Min(1)
  weeks!: number;
}
