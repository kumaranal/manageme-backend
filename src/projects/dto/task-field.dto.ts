import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTaskFieldDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
