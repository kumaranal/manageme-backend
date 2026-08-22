import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssuesService } from './issues.service';
import { PermissionsService } from '../common/permissions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { MoveIssueDto } from './dto/move-issue.dto';
import { AddCommentDto } from './dto/add-comment.dto';

@ApiTags('issues')
@ApiBearerAuth('bearer')
@Controller('organizations/:orgId/projects/:projectId/issues')
export class IssuesController {
  constructor(
    private readonly issues: IssuesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgMember(orgId, user.id);
    return this.issues.list(orgId, projectId);
  }

  @Post()
  async create(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.issues.create(orgId, projectId, user.id, dto);
  }

  @Patch(':issueId')
  async update(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    const { activityText, ...patch } = dto;
    return this.issues.update(orgId, projectId, issueId, user.id, patch, activityText);
  }

  @Patch(':issueId/move')
  async move(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: MoveIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.issues.move(orgId, projectId, issueId, user.id, dto.statusId, dto.index);
  }

  @Post(':issueId/comments')
  async addComment(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.issues.addComment(orgId, projectId, issueId, user.id, dto.body);
  }

  @Put(':issueId/cc/:userId')
  async addCc(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Param('userId') ccUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.issues.addCc(orgId, projectId, issueId, ccUserId);
  }

  @Delete(':issueId/cc/:userId')
  async removeCc(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Param('userId') ccUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.issues.removeCc(orgId, projectId, issueId, ccUserId);
  }
}
