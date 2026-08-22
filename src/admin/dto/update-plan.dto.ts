import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceInrPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceUsdCents?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
