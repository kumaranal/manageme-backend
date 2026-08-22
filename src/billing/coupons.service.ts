import { BadRequestException, Injectable } from '@nestjs/common';
import { BillingCurrency, Coupon, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Gateway practical minimums a charge is clamped to, so a heavy discount never
// produces an amount Razorpay/Stripe would reject outright.
const MIN_AMOUNT: Record<BillingCurrency, number> = {
  INR: 100, // ₹1 in paise
  USD: 50, // $0.50 in cents
};

export interface PriceResult {
  subtotal: number;
  discount: number;
  total: number;
  couponId: string | null;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async priceFor(
    plan: SubscriptionPlan,
    currency: BillingCurrency,
    couponCode?: string,
  ): Promise<PriceResult> {
    const subtotal =
      currency === 'INR' ? plan.priceInrPaise : plan.priceUsdCents;
    if (!couponCode)
      return { subtotal, discount: 0, total: subtotal, couponId: null };

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });
    if (!coupon || !coupon.active)
      throw new BadRequestException('Invalid coupon code');
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Coupon has expired');
    }
    if (
      coupon.maxRedemptions != null &&
      coupon.timesRedeemed >= coupon.maxRedemptions
    ) {
      throw new BadRequestException('Coupon has reached its redemption limit');
    }

    const rawDiscount = this.computeRawDiscount(coupon, subtotal, currency);
    const total = Math.max(MIN_AMOUNT[currency], subtotal - rawDiscount);
    const discount = subtotal - total;
    return { subtotal, discount, total, couponId: coupon.id };
  }

  private computeRawDiscount(
    coupon: Coupon,
    subtotal: number,
    currency: BillingCurrency,
  ): number {
    if (coupon.discountType === 'PERCENT') {
      if (!coupon.percentOff) return 0;
      return Math.floor((subtotal * coupon.percentOff) / 100);
    }
    const fixed =
      currency === 'INR' ? coupon.fixedOffInrPaise : coupon.fixedOffUsdCents;
    if (fixed == null)
      throw new BadRequestException(`Coupon is not valid for ${currency}`);
    return fixed;
  }
}
