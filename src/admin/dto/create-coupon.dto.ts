import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CouponDiscountType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string;

  @IsIn(['PERCENT', 'FIXED'])
  discountType!: CouponDiscountType;

  @ValidateIf((o: CreateCouponDto) => o.discountType === 'PERCENT')
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @ValidateIf((o: CreateCouponDto) => o.discountType === 'FIXED')
  @IsOptional()
  @IsInt()
  @Min(0)
  fixedOffInrPaise?: number;

  @ValidateIf((o: CreateCouponDto) => o.discountType === 'FIXED')
  @IsOptional()
  @IsInt()
  @Min(0)
  fixedOffUsdCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
