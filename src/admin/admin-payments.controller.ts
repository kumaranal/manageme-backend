import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAnalyticsService } from './admin-analytics.service';
import { SuperadminGuard } from '../auth/superadmin.guard';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get()
  list(@Query() query: ListPaymentsQueryDto) {
    return this.analytics.listPayments(query);
  }
}
