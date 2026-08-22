import { Injectable } from '@nestjs/common';
import { BillingCurrency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedQueryDto } from './dto/paginated-query.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

interface RevenueBucketRow {
  bucket: Date;
  currency: BillingCurrency;
  total: bigint;
  count: bigint;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      orgCount,
      suspendedCount,
      userCount,
      activeSubscriptions,
      revenueByCurrency,
      couponStats,
      newOrgsThisMonth,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.subscription.count({
        where: { currentPeriodEnd: { gt: now } },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.coupon.aggregate({ _sum: { timesRedeemed: true } }),
      this.prisma.organization.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      organizations: {
        total: orgCount,
        active: orgCount - suspendedCount,
        suspended: suspendedCount,
        newThisMonth: newOrgsThisMonth,
      },
      users: { total: userCount },
      // Every org gets a Subscription row at creation time, so total - active = expired.
      subscriptions: {
        active: activeSubscriptions,
        expired: orgCount - activeSubscriptions,
      },
      revenue: revenueByCurrency.map((r) => ({
        currency: r.currency,
        totalAmount: r._sum.amount ?? 0,
        paymentCount: r._count._all,
      })),
      coupons: { totalRedemptions: couponStats._sum.timesRedeemed ?? 0 },
    };
  }

  async revenueSeries(granularity: 'day' | 'month', from: Date, to: Date) {
    const trunc = granularity === 'month' ? 'month' : 'day';
    const rows = await this.prisma.$queryRaw<RevenueBucketRow[]>`
      SELECT date_trunc(${trunc}, "createdAt") AS bucket, currency, SUM(amount) AS total, COUNT(*) AS count
      FROM payments
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY bucket, currency
      ORDER BY bucket ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket,
      currency: r.currency,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }

  async listOrganizations(query: PaginatedQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.OrganizationWhereInput = query.query
      ? {
          OR: [
            { name: { contains: query.query, mode: 'insensitive' } },
            { slug: { contains: query.query, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          _count: { select: { members: true, projects: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        createdAt: o.createdAt,
        memberCount: o._count.members,
        projectCount: o._count.projects,
        plan: o.subscription
          ? { id: o.subscription.plan.id, name: o.subscription.plan.name }
          : null,
        subscriptionActive: o.subscription
          ? o.subscription.currentPeriodEnd.getTime() > Date.now()
          : false,
        currentPeriodEnd: o.subscription?.currentPeriodEnd ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listUsers(query: PaginatedQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.UserWhereInput = query.query
      ? {
          OR: [
            { name: { contains: query.query, mode: 'insensitive' } },
            { email: { contains: query.query, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { memberships: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        isSuperadmin: u.isSuperadmin,
        createdAt: u.createdAt,
        orgCount: u._count.memberships,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listPayments(query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.PaymentWhereInput = {
      ...(query.gateway ? { gateway: query.gateway } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          org: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
