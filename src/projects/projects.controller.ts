import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { PermissionsService } from '../common/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { SubscriptionGuard } from '../auth/subscription.guard';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  AddProjectMemberDto,
  UpdateProjectMemberHoursDto,
  UpdateProjectMemberRoleDto,
} from './dto/project-member.dto';
import { MoveStatusDto, RenameStatusDto } from './dto/status.dto';
import { UpdateTaskFieldDto } from './dto/task-field.dto';
import { CreateSprintDto, UpdateSprintLengthDto } from './dto/sprint.dto';
import { CreateStoreItemDto, UpdateStoreItemDto } from './dto/store-item.dto';
import { mapProject } from '../common/mappers';
import { StorageService } from '../storage/storage.service';
import type { TaskFieldKey } from '@prisma/client';

const fullProjectInclude = {
  members: true,
  taskFields: true,
  statuses: { orderBy: { position: 'asc' as const } },
  sprints: true,
  storeItems: { include: { history: { orderBy: { at: 'desc' as const } } } },
  issues: {
    include: {
      comments: { orderBy: { createdAt: 'desc' as const } },
      activity: { orderBy: { createdAt: 'desc' as const } },
      attachments: { orderBy: { createdAt: 'asc' as const } },
      cc: true,
      branches: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  repo: true,
};

@ApiTags('projects')
@ApiBearerAuth('bearer')
@UseGuards(SubscriptionGuard)
@Controller('organizations/:orgId/projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly permissions: PermissionsService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgMember(orgId, user.id);
    const projects = await this.prisma.project.findMany({
      where: { orgId },
      include: fullProjectInclude,
    });
    return Promise.all(projects.map((p) => mapProject(p, this.storage)));
  }

  @Get(':projectId')
  async findOne(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgMember(orgId, user.id);
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: projectId, orgId },
      include: fullProjectInclude,
    });
    return mapProject(project, this.storage);
  }

  @Post()
  async create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgMember(orgId, user.id);
    return this.projects.create(orgId, user.id, dto.name);
  }

  @Patch(':projectId/archive')
  async toggleArchive(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projects.toggleArchive(orgId, projectId);
  }

  @Post(':projectId/members')
  async addMember(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projects.addMember(orgId, projectId, dto.userId);
  }

  @Patch(':projectId/members/:userId/role')
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateProjectMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projects.updateMemberRole(
      orgId,
      projectId,
      targetUserId,
      dto.role,
    );
  }

  @Patch(':projectId/members/:userId/hours')
  async updateMemberHours(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateProjectMemberHoursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projects.updateMemberHours(
      orgId,
      projectId,
      targetUserId,
      dto.hours ?? null,
    );
  }

  @Delete(':projectId/members/:userId')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    await this.projects.removeMember(orgId, projectId, targetUserId);
    return { ok: true };
  }

  @Patch(':projectId/statuses/:statusId/rename')
  async renameStatus(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
    @Body() dto: RenameStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.renameStatus(orgId, projectId, statusId, dto.name);
  }

  @Patch(':projectId/statuses/:statusId/move')
  async moveStatus(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
    @Body() dto: MoveStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.moveStatus(orgId, projectId, statusId, dto.direction);
  }

  @Post(':projectId/statuses')
  async addStatus(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.addStatus(orgId, projectId);
  }

  @Delete(':projectId/statuses/:statusId')
  async deleteStatus(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    await this.projects.deleteStatus(orgId, projectId, statusId);
    return { ok: true };
  }

  @Patch(':projectId/task-fields/:fieldKey')
  async updateTaskField(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('fieldKey') fieldKey: TaskFieldKey,
    @Body() dto: UpdateTaskFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projects.updateTaskField(orgId, projectId, fieldKey, dto);
  }

  @Patch(':projectId/sprint-config')
  async updateSprintLength(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateSprintLengthDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projects.updateSprintLength(orgId, projectId, dto.weeks);
  }

  @Post(':projectId/sprints')
  async createSprint(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.createSprint(
      orgId,
      projectId,
      dto.name,
      dto.startDate,
      dto.endDate,
    );
  }

  @Patch(':projectId/sprints/:sprintId/start')
  async startSprint(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.startSprint(orgId, projectId, sprintId);
  }

  @Patch(':projectId/sprints/:sprintId/complete')
  async completeSprint(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.completeSprint(orgId, projectId, sprintId);
  }

  @Post(':projectId/store')
  async createStoreItem(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateStoreItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    return this.projects.createStoreItem(orgId, projectId, user.id, dto);
  }

  @Patch(':projectId/store/:itemId')
  async updateStoreItem(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateStoreItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    const { historyText, ...patch } = dto;
    return this.projects.updateStoreItem(
      orgId,
      projectId,
      itemId,
      user.id,
      patch,
      historyText,
    );
  }

  @Delete(':projectId/store/:itemId')
  async deleteStoreItem(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectEdit(orgId, projectId, user.id);
    await this.projects.deleteStoreItem(orgId, projectId, itemId);
    return { ok: true };
  }
}
