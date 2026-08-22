import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class AdminPlansService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({ data: dto });
  }

  update(id: string, dto: UpdatePlanDto) {
    return this.prisma.subscriptionPlan.update({ where: { id }, data: dto });
  }
}
