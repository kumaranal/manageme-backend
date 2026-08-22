import { IsInt, Min } from 'class-validator';

export class UpdateCapacityDto {
  @IsInt()
  @Min(1)
  hours!: number;
}
