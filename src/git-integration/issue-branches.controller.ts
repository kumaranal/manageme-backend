import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssueBranchesService } from './issue-branches.service';
import { PermissionsService } from '../common/permissions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { CreateBranchDto } from './dto/create-branch.dto';

@ApiTags('git-integration')
@ApiBearerAuth('bearer')
@Controller('organizations/:orgId/projects/:projectId/issues/:issueId/branches')
export class IssueBranchesController {
  constructor(
    private readonly issueBranches: IssueBranchesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectRead(orgId, projectId, user.id);
    return this.issueBranches.list(orgId, projectId, issueId);
  }

  @Post()
  async create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.issueBranches.create(orgId, projectId, issueId, user.id, dto.slug);
  }
}
