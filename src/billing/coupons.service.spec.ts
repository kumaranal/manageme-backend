import { BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { Coupon, SubscriptionPlan } from '@prisma/client';

function makePlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 'plan_1',
    name: 'Pro',
    description: '',
    periodDays: 30,
    priceInrPaise: 99900,
    priceUsdCents: 1500,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon_1',
    code: 'SAVE10',
    discountType: 'PERCENT',
    percentOff: 10,
    fixedOffInrPaise: null,
    fixedOffUsdCents: null,
    maxRedemptions: null,
    timesRedeemed: 0,
    active: true,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CouponsService.priceFor', () => {
  function makeService(coupon: Coupon | null) {
    const prisma = {
      coupon: { findUnique: jest.fn().mockResolvedValue(coupon) },
    };
    return new CouponsService(prisma as any);
  }

  it('returns the full price with no discount when no coupon is given', async () => {
    const service = makeService(null);
    const result = await service.priceFor(makePlan(), 'INR');
    expect(result).toEqual({
      subtotal: 99900,
      discount: 0,
      total: 99900,
      couponId: null,
    });
  });

  it('applies a percent discount', async () => {
    const coupon = makeCoupon({ discountType: 'PERCENT', percentOff: 20 });
    const service = makeService(coupon);
    const result = await service.priceFor(makePlan(), 'INR', 'SAVE10');
    expect(result).toEqual({
      subtotal: 99900,
      discount: 19980,
      total: 79920,
      couponId: 'coupon_1',
    });
  });

  it('applies a fixed discount in the matching currency', async () => {
    const coupon = makeCoupon({
      discountType: 'FIXED',
      percentOff: null,
      fixedOffUsdCents: 500,
    });
    const service = makeService(coupon);
    const result = await service.priceFor(makePlan(), 'USD', 'SAVE10');
    expect(result).toEqual({
      subtotal: 1500,
      discount: 500,
      total: 1000,
      couponId: 'coupon_1',
    });
  });

  it('rejects a fixed coupon with no amount configured for the checkout currency', async () => {
    const coupon = makeCoupon({
      discountType: 'FIXED',
      percentOff: null,
      fixedOffUsdCents: 500,
    });
    const service = makeService(coupon);
    await expect(
      service.priceFor(makePlan(), 'INR', 'SAVE10'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clamps the discount so the total never drops below the gateway minimum', async () => {
    const coupon = makeCoupon({ discountType: 'PERCENT', percentOff: 100 });
    const service = makeService(coupon);
    const result = await service.priceFor(makePlan(), 'INR', 'SAVE10');
    expect(result.total).toBe(100); // ₹1 minimum
    expect(result.discount).toBe(99800);
  });

  it('rejects an expired coupon', async () => {
    const coupon = makeCoupon({ expiresAt: new Date(Date.now() - 1000) });
    const service = makeService(coupon);
    await expect(
      service.priceFor(makePlan(), 'INR', 'SAVE10'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a coupon that has reached its redemption limit', async () => {
    const coupon = makeCoupon({ maxRedemptions: 5, timesRedeemed: 5 });
    const service = makeService(coupon);
    await expect(
      service.priceFor(makePlan(), 'INR', 'SAVE10'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown coupon code', async () => {
    const service = makeService(null);
    await expect(
      service.priceFor(makePlan(), 'INR', 'NOPE'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
