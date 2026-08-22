import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class AdminCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateCouponDto) {
    if (
      dto.discountType === 'FIXED' &&
      dto.fixedOffInrPaise == null &&
      dto.fixedOffUsdCents == null
    ) {
      throw new BadRequestException(
        'FIXED coupons need at least one of fixedOffInrPaise/fixedOffUsdCents set',
      );
    }
    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        discountType: dto.discountType,
        percentOff: dto.percentOff,
        fixedOffInrPaise: dto.fixedOffInrPaise,
        fixedOffUsdCents: dto.fixedOffUsdCents,
        maxRedemptions: dto.maxRedemptions,
        active: dto.active,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  update(id: string, dto: UpdateCouponDto) {
    return this.prisma.coupon.update({
      where: { id },
      data: {
        percentOff: dto.percentOff,
        fixedOffInrPaise: dto.fixedOffInrPaise,
        fixedOffUsdCents: dto.fixedOffUsdCents,
        maxRedemptions: dto.maxRedemptions,
        active: dto.active,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }
}
