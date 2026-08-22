import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  periodDays!: number;

  @IsInt()
  @Min(0)
  priceInrPaise!: number;

  @IsInt()
  @Min(0)
  priceUsdCents!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
