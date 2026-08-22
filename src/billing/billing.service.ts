import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PlansService } from './plans.service';
import { CouponsService } from './coupons.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { RenewCheckoutDto } from './dto/renew-checkout.dto';

const CHECKOUT_TTL_MS = 30 * 60 * 1000;

// The razorpay SDK rejects with a plain { statusCode, error: { description } }
// object rather than an Error instance — pull out something readable from it.
function razorpayErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const description = (err as { error?: { description?: string } }).error
      ?.description;
    if (description) return description;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly organizations: OrganizationsService,
    private readonly plans: PlansService,
    private readonly coupons: CouponsService,
    private readonly razorpay: RazorpayProvider,
    private readonly stripe: StripeProvider,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  async initiateNewOrgCheckout(userId: string, dto: CreateCheckoutDto) {
    const plan = await this.plans.getActiveOrThrow(dto.planId);
    const pricing = await this.coupons.priceFor(
      plan,
      dto.currency,
      dto.couponCode,
    );

    const session = await this.prisma.checkoutSession.create({
      data: {
        userId,
        kind: 'NEW_ORG',
        orgName: dto.orgName,
        planId: plan.id,
        couponId: pricing.couponId,
        currency: dto.currency,
        gateway: dto.currency === 'INR' ? 'RAZORPAY' : 'STRIPE',
        subtotalAmount: pricing.subtotal,
        discountAmount: pricing.discount,
        totalAmount: pricing.total,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
      },
    });

    return this.startGatewayCheckout(
      session.id,
      userId,
      dto.currency,
      pricing.total,
      `Organization: ${dto.orgName}`,
    );
  }

  async initiateRenewalCheckout(
    userId: string,
    orgId: string,
    dto: RenewCheckoutDto,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
    });
    if (!subscription)
      throw new NotFoundException('Organization has no subscription to renew');
    const plan = await this.plans.getActiveOrThrow(
      dto.planId ?? subscription.planId,
    );
    const pricing = await this.coupons.priceFor(
      plan,
      dto.currency,
      dto.couponCode,
    );

    const session = await this.prisma.checkoutSession.create({
      data: {
        userId,
        kind: 'RENEWAL',
        renewOrgId: orgId,
        planId: plan.id,
        couponId: pricing.couponId,
        currency: dto.currency,
        gateway: dto.currency === 'INR' ? 'RAZORPAY' : 'STRIPE',
        subtotalAmount: pricing.subtotal,
        discountAmount: pricing.discount,
        totalAmount: pricing.total,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
      },
    });

    return this.startGatewayCheckout(
      session.id,
      userId,
      dto.currency,
      pricing.total,
      `Subscription renewal: ${plan.name}`,
    );
  }

  private async startGatewayCheckout(
    checkoutSessionId: string,
    userId: string,
    currency: 'INR' | 'USD',
    amount: number,
    productName: string,
  ) {
    // A free plan (no coupon involved — CouponsService clamps any discounted
    // total to a gateway minimum, so this only fires for a genuinely $0/₹0
    // plan) skips the payment gateway entirely and finalizes immediately.
    if (amount === 0) {
      await this.finalize(checkoutSessionId, 'FREE');
      const status = await this.getStatus(checkoutSessionId, userId);
      return { checkoutSessionId, gateway: 'FREE' as const, amount, currency, ...status };
    }

    if (currency === 'INR') {
      const order = await this.razorpay
        .createOrder(amount, checkoutSessionId)
        .catch((err: unknown) => {
          throw new BadRequestException(
            `Razorpay rejected the checkout: ${razorpayErrorMessage(err)}`,
          );
        });
      await this.prisma.checkoutSession.update({
        where: { id: checkoutSessionId },
        data: { gatewayOrderId: order.id },
      });
      return {
        checkoutSessionId,
        gateway: 'RAZORPAY' as const,
        razorpayKeyId: this.razorpay.keyId,
        orderId: order.id,
        amount,
        currency,
      };
    }

    const checkout = await this.stripe
      .createCheckoutSession({
        amountCents: amount,
        productName,
        successUrl: `${this.frontendUrl}/checkout/success?session_id=${checkoutSessionId}`,
        cancelUrl: `${this.frontendUrl}/checkout/cancel?session_id=${checkoutSessionId}`,
        metadata: { checkoutSessionId },
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new BadRequestException(`Stripe rejected the checkout: ${message}`);
      });
    await this.prisma.checkoutSession.update({
      where: { id: checkoutSessionId },
      data: { gatewayOrderId: checkout.id },
    });
    return {
      checkoutSessionId,
      gateway: 'STRIPE' as const,
      checkoutUrl: checkout.url,
      amount,
      currency,
    };
  }

  async getStatus(checkoutSessionId: string, userId: string) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundException('Checkout session not found');
    return {
      status: session.status,
      createdOrgId: session.createdOrgId,
      renewOrgId: session.renewOrgId,
    };
  }

  async verifyRazorpayPayment(params: {
    checkoutSessionId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: params.checkoutSessionId },
    });
    if (!session || session.gatewayOrderId !== params.razorpayOrderId) {
      throw new BadRequestException('Unknown checkout session or order');
    }
    const valid = this.razorpay.verifyPaymentSignature(
      params.razorpayOrderId,
      params.razorpayPaymentId,
      params.razorpaySignature,
    );
    if (!valid) throw new BadRequestException('Invalid payment signature');

    await this.finalize(session.id, params.razorpayPaymentId);
    return this.getStatus(session.id, session.userId);
  }

  async findByGatewayOrderId(gatewayOrderId: string) {
    return this.prisma.checkoutSession.findFirst({ where: { gatewayOrderId } });
  }

  async markFailed(checkoutSessionId: string) {
    await this.prisma.checkoutSession.updateMany({
      where: { id: checkoutSessionId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }

  // The single idempotent completion path — used by the Razorpay client-verify
  // endpoint and both gateway webhooks. Safe to call more than once for the
  // same session: only the first caller to flip PENDING -> COMPLETED proceeds.
  async finalize(
    checkoutSessionId: string,
    gatewayPaymentId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.checkoutSession.updateMany({
        where: { id: checkoutSessionId, status: 'PENDING' },
        data: { status: 'COMPLETED', gatewayPaymentId },
      });
      if (claimed.count === 0) return;

      const session = await tx.checkoutSession.findUniqueOrThrow({
        where: { id: checkoutSessionId },
        include: { plan: true },
      });

      const now = new Date();
      let orgId: string;
      let subscriptionId: string;

      if (session.kind === 'NEW_ORG') {
        const org = await this.organizations.createWithinTransaction(
          tx,
          session.userId,
          session.orgName!,
        );
        const subscription = await tx.subscription.create({
          data: {
            orgId: org.id,
            planId: session.planId,
            currentPeriodStart: now,
            currentPeriodEnd: addDays(now, session.plan.periodDays),
          },
        });
        await tx.checkoutSession.update({
          where: { id: session.id },
          data: { createdOrgId: org.id },
        });
        orgId = org.id;
        subscriptionId = subscription.id;
      } else {
        const existing = await tx.subscription.findUniqueOrThrow({
          where: { orgId: session.renewOrgId! },
        });
        const base =
          existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
        const updated = await tx.subscription.update({
          where: { orgId: session.renewOrgId! },
          data: {
            planId: session.planId,
            currentPeriodEnd: addDays(base, session.plan.periodDays),
          },
        });
        orgId = session.renewOrgId!;
        subscriptionId = updated.id;
      }

      await tx.payment.create({
        data: {
          checkoutSessionId: session.id,
          orgId,
          subscriptionId,
          userId: session.userId,
          gateway: session.gateway,
          currency: session.currency,
          amount: session.totalAmount,
          gatewayPaymentId,
        },
      });

      if (session.couponId) {
        await tx.coupon.update({
          where: { id: session.couponId },
          data: { timesRedeemed: { increment: 1 } },
        });
      }
    });
  }
}
