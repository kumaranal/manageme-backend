import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SKIP_SUBSCRIPTION_CHECK_KEY } from './skip-subscription-check.decorator';
import type { AuthenticatedUser } from './supabase-auth.guard';

// Controller/method-level guard (not global) — runs after the global
// SupabaseAuthGuard, so request.user is always already populated here.
// Blocks org-scoped routes (anything with an :orgId param) once that org's
// subscription has lapsed, so an org actually has to renew to keep using
// the product rather than the expiry just being a display flag.
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (user?.isSuperadmin) return true;

    const orgId = request.params?.orgId as string | undefined;
    if (!orgId) return true;

    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      select: { currentPeriodEnd: true },
    });
    if (!subscription || subscription.currentPeriodEnd.getTime() < Date.now()) {
      throw new HttpException(
        'Subscription has expired — renew to regain access',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
