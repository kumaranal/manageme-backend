import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAnalyticsService } from './admin-analytics.service';
import { SuperadminGuard } from '../auth/superadmin.guard';
import { PaginatedQueryDto } from './dto/paginated-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@ApiTags('admin')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('revenue')
  revenue(@Query() query: RevenueQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * DAY_MS);
    return this.analytics.revenueSeries(query.granularity ?? 'day', from, to);
  }

  @Get('organizations')
  organizations(@Query() query: PaginatedQueryDto) {
    return this.analytics.listOrganizations(query);
  }

  @Get('users')
  users(@Query() query: PaginatedQueryDto) {
    return this.analytics.listUsers(query);
  }
}
