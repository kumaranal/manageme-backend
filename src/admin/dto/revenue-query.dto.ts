import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class RevenueQueryDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  granularity?: 'day' | 'month';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
