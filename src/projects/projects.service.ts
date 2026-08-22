import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { deriveProjectKey } from '../common/slug';
import { ProjectRole, StoreKind, TaskFieldKey } from '@prisma/client';

const DEFAULT_TASK_FIELDS: { fieldKey: TaskFieldKey; label: string; enabled: boolean }[] = [
  { fieldKey: 'priority', label: 'Priority', enabled: true },
  { fieldKey: 'assignee', label: 'Assignee', enabled: true },
  { fieldKey: 'dueDate', label: 'Due date', enabled: true },
  { fieldKey: 'labels', label: 'Labels', enabled: false },
  { fieldKey: 'estimatedHours', label: 'Estimated hours', enabled: true },
];

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireProject(orgId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, orgId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async requireStatus(projectId: string, statusId: string) {
    const status = await this.prisma.status.findFirst({ where: { id: statusId, projectId } });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }

  private async requireSprint(projectId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  private async requireStoreItem(projectId: string, itemId: string) {
    const item = await this.prisma.storeItem.findFirst({ where: { id: itemId, projectId } });
    if (!item) throw new NotFoundException('Store item not found');
    return item;
  }

  async create(orgId: string, leadUserId: string, name: string) {
    const existingKeys = (
      await this.prisma.project.findMany({ where: { orgId }, select: { key: true } })
    ).map((p) => p.key);
    const key = deriveProjectKey(name, existingKeys);

    return this.prisma.project.create({
      data: {
        orgId,
        key,
        name,
        blurb: 'A fresh project — nothing here yet.',
        leadId: leadUserId,
        members: { create: { userId: leadUserId, role: 'LEAD' } },
        taskFields: { create: DEFAULT_TASK_FIELDS },
        statuses: {
          create: [
            { name: 'To Do', category: 'TODO', position: 0 },
            { name: 'In Progress', category: 'IN_PROGRESS', position: 1 },
            { name: 'Done', category: 'DONE', position: 2 },
          ],
        },
      },
      include: { members: true, taskFields: true, statuses: true, sprints: true },
    });
  }

  async toggleArchive(orgId: string, projectId: string) {
    const project = await this.requireProject(orgId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archived: !project.archived },
    });
  }

  async addMember(orgId: string, projectId: string, userId: string) {
    await this.requireProject(orgId, projectId);
    return this.prisma.projectMembership.create({
      data: { projectId, userId, role: 'CONTRIBUTOR' },
    });
  }

  async updateMemberRole(orgId: string, projectId: string, userId: string, role: ProjectRole) {
    await this.requireProject(orgId, projectId);
    return this.prisma.projectMembership.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
    });
  }

  async removeMember(orgId: string, projectId: string, userId: string) {
    await this.requireProject(orgId, projectId);
    await this.prisma.projectMembership.delete({ where: { projectId_userId: { projectId, userId } } });
  }

  async updateMemberHours(orgId: string, projectId: string, userId: string, hours: number | null) {
    await this.requireProject(orgId, projectId);
    return this.prisma.projectMembership.update({
      where: { projectId_userId: { projectId, userId } },
      data: { weeklyHours: hours },
    });
  }

  async renameStatus(orgId: string, projectId: string, statusId: string, name: string) {
    await this.requireProject(orgId, projectId);
    await this.requireStatus(projectId, statusId);
    return this.prisma.status.update({ where: { id: statusId }, data: { name } });
  }

  async moveStatus(orgId: string, projectId: string, statusId: string, dir: 'up' | 'down') {
    await this.requireProject(orgId, projectId);
    const statuses = await this.prisma.status.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    const idx = statuses.findIndex((s) => s.id === statusId);
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= statuses.length) return statuses;

    const a = statuses[idx];
    const b = statuses[swapWith];
    await this.prisma.$transaction([
      // Bump `a` out of the way first to dodge the (projectId, position) unique constraint.
      this.prisma.status.update({ where: { id: a.id }, data: { position: -1 } }),
      this.prisma.status.update({ where: { id: b.id }, data: { position: a.position } }),
      this.prisma.status.update({ where: { id: a.id }, data: { position: b.position } }),
    ]);
    return this.prisma.status.findMany({ where: { projectId }, orderBy: { position: 'asc' } });
  }

  async addStatus(orgId: string, projectId: string) {
    await this.requireProject(orgId, projectId);
    const statuses = await this.prisma.status.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    // New column is inserted second-to-last, mirroring the frontend (before the final column).
    const insertAt = Math.max(0, statuses.length - 1);
    await this.prisma.$transaction(
      statuses.slice(insertAt).map((s) =>
        this.prisma.status.update({ where: { id: s.id }, data: { position: s.position + 1 } }),
      ),
    );
    return this.prisma.status.create({
      data: { projectId, name: 'New column', category: 'IN_PROGRESS', position: insertAt },
    });
  }

  async deleteStatus(orgId: string, projectId: string, statusId: string) {
    await this.requireProject(orgId, projectId);
    await this.requireStatus(projectId, statusId);
    const inUse = await this.prisma.issue.findFirst({ where: { projectId, statusId } });
    if (inUse) throw new BadRequestException('Cannot delete a column that still has issues');
    await this.prisma.status.delete({ where: { id: statusId } });
  }

  async updateTaskField(
    orgId: string,
    projectId: string,
    fieldKey: TaskFieldKey,
    patch: { enabled?: boolean; required?: boolean },
  ) {
    await this.requireProject(orgId, projectId);
    const data = { ...patch };
    if (data.enabled === false) data.required = false;
    return this.prisma.taskField.update({
      where: { projectId_fieldKey: { projectId, fieldKey } },
      data,
    });
  }

  async updateSprintLength(orgId: string, projectId: string, weeks: number) {
    await this.requireProject(orgId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { sprintLengthWeeks: weeks },
    });
  }

  async createSprint(orgId: string, projectId: string, name: string, startDate: string, endDate: string) {
    await this.requireProject(orgId, projectId);
    return this.prisma.sprint.create({
      data: { projectId, name, startDate: new Date(startDate), endDate: new Date(endDate) },
    });
  }

  async startSprint(orgId: string, projectId: string, sprintId: string) {
    await this.requireProject(orgId, projectId);
    await this.requireSprint(projectId, sprintId);
    await this.prisma.sprint.updateMany({
      where: { projectId, status: 'ACTIVE' },
      data: { status: 'PLANNED' },
    });
    return this.prisma.sprint.update({ where: { id: sprintId }, data: { status: 'ACTIVE' } });
  }

  async completeSprint(orgId: string, projectId: string, sprintId: string) {
    await this.requireProject(orgId, projectId);
    await this.requireSprint(projectId, sprintId);
    return this.prisma.sprint.update({ where: { id: sprintId }, data: { status: 'CLOSED' } });
  }

  async createStoreItem(
    orgId: string,
    projectId: string,
    userId: string,
    data: { title: string; kind: StoreKind; content: string },
  ) {
    await this.requireProject(orgId, projectId);
    return this.prisma.storeItem.create({
      data: {
        projectId,
        title: data.title,
        kind: data.kind,
        content: data.content,
        updatedById: userId,
        history: { create: { actorId: userId, text: 'created this item' } },
      },
      include: { history: true },
    });
  }

  async updateStoreItem(
    orgId: string,
    projectId: string,
    itemId: string,
    userId: string,
    patch: { title?: string; content?: string; kind?: StoreKind },
    historyText?: string,
  ) {
    await this.requireProject(orgId, projectId);
    await this.requireStoreItem(projectId, itemId);
    return this.prisma.storeItem.update({
      where: { id: itemId },
      data: {
        ...patch,
        updatedById: userId,
        ...(historyText ? { history: { create: { actorId: userId, text: historyText } } } : {}),
      },
      include: { history: { orderBy: { at: 'desc' } } },
    });
  }

  async deleteStoreItem(orgId: string, projectId: string, itemId: string) {
    await this.requireProject(orgId, projectId);
    await this.requireStoreItem(projectId, itemId);
    await this.prisma.storeItem.delete({ where: { id: itemId } });
  }
}
