import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceInrPaise: 'asc' },
    });
  }

  async getActiveOrThrow(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan || !plan.active) throw new NotFoundException('Plan not found');
    return plan;
  }
}
