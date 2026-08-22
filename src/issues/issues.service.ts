import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IssueType, Priority } from '@prisma/client';

const issueInclude = {
  comments: { orderBy: { createdAt: 'asc' as const } },
  activity: { orderBy: { createdAt: 'desc' as const } },
  cc: true,
};

@Injectable()
export class IssuesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireProject(orgId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, orgId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async requireIssue(projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  list(orgId: string, projectId: string) {
    return this.prisma.issue.findMany({
      where: { projectId, project: { orgId } },
      include: issueInclude,
      orderBy: { rank: 'asc' },
    });
  }

  async create(
    orgId: string,
    projectId: string,
    userId: string,
    data: {
      title: string;
      type: IssueType;
      statusId: string;
      priority: Priority;
      assignee?: string | null;
      due?: string | null;
      labels?: string[];
      estimatedHours?: number | null;
      sprintId?: string | null;
    },
  ) {
    await this.requireProject(orgId, projectId);

    const topRank = await this.prisma.issue.aggregate({
      where: { projectId, statusId: data.statusId },
      _max: { rank: true },
    });
    const rank = (topRank._max.rank ?? 0) + 1000;

    const sprint = data.sprintId
      ? await this.prisma.sprint.findUnique({ where: { id: data.sprintId } })
      : null;

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { counter: { increment: 1 } },
    });

    return this.prisma.issue.create({
      data: {
        projectId,
        number: project.counter,
        title: data.title,
        type: data.type,
        priority: data.priority,
        assigneeId: data.assignee ?? null,
        statusId: data.statusId,
        rank,
        due: sprint ? sprint.endDate : data.due ? new Date(data.due) : null,
        labels: data.labels ?? [],
        estimatedHours: data.estimatedHours ?? null,
        sprintId: data.sprintId ?? null,
        activity: { create: { actorId: userId, text: 'created this issue' } },
      },
      include: issueInclude,
    });
  }

  async update(
    orgId: string,
    projectId: string,
    issueId: string,
    userId: string,
    patch: {
      title?: string;
      type?: IssueType;
      priority?: Priority;
      assignee?: string | null;
      statusId?: string;
      due?: string | null;
      labels?: string[];
      estimatedHours?: number | null;
      sprintId?: string | null;
    },
    activityText?: string,
  ) {
    await this.requireProject(orgId, projectId);
    await this.requireIssue(projectId, issueId);

    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.assignee !== undefined) data.assigneeId = patch.assignee;
    if (patch.statusId !== undefined) data.statusId = patch.statusId;
    if (patch.labels !== undefined) data.labels = patch.labels;
    if (patch.estimatedHours !== undefined) data.estimatedHours = patch.estimatedHours;

    if (patch.sprintId !== undefined) {
      data.sprintId = patch.sprintId;
      const sprint = patch.sprintId
        ? await this.prisma.sprint.findUnique({ where: { id: patch.sprintId } })
        : null;
      data.due = sprint ? sprint.endDate : patch.due ? new Date(patch.due) : null;
    } else if (patch.due !== undefined) {
      data.due = patch.due ? new Date(patch.due) : null;
    }

    if (activityText) {
      data.activity = { create: { actorId: userId, text: activityText } };
    }

    return this.prisma.issue.update({ where: { id: issueId }, data, include: issueInclude });
  }

  async move(orgId: string, projectId: string, issueId: string, userId: string, statusId: string, index: number) {
    await this.requireProject(orgId, projectId);
    const issue = await this.requireIssue(projectId, issueId);

    const column = await this.prisma.issue.findMany({
      where: { projectId, statusId, id: { not: issueId } },
      orderBy: { rank: 'asc' },
    });
    const prev = column[index - 1];
    const next = column[index];
    const lo = prev ? prev.rank : 0;
    const hi = next ? next.rank : column.length ? column[column.length - 1].rank + 2000 : 2000;
    const rank = prev || next ? (lo + hi) / 2 : 1000;

    const statusChanged = issue.statusId !== statusId;
    let activityCreate: { create: { actorId: string; text: string } } | undefined;
    if (statusChanged) {
      const [from, to] = await Promise.all([
        this.prisma.status.findUnique({ where: { id: issue.statusId } }),
        this.prisma.status.findUnique({ where: { id: statusId } }),
      ]);
      if (from && to) {
        activityCreate = { create: { actorId: userId, text: `moved ${from.name} → ${to.name}` } };
      }
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: {
        statusId,
        rank,
        ...(activityCreate ? { activity: activityCreate } : {}),
      },
      include: issueInclude,
    });
  }

  async addComment(orgId: string, projectId: string, issueId: string, userId: string, body: string) {
    await this.requireProject(orgId, projectId);
    await this.requireIssue(projectId, issueId);
    await this.prisma.comment.create({ data: { issueId, authorId: userId, body } });
    await this.prisma.activityEntry.create({
      data: { issueId, actorId: userId, text: 'commented' },
    });
    return this.prisma.issue.findUniqueOrThrow({ where: { id: issueId }, include: issueInclude });
  }

  async addCc(orgId: string, projectId: string, issueId: string, ccUserId: string) {
    await this.requireProject(orgId, projectId);
    await this.requireIssue(projectId, issueId);
    await this.prisma.issueCc.upsert({
      where: { issueId_userId: { issueId, userId: ccUserId } },
      update: {},
      create: { issueId, userId: ccUserId },
    });
    return this.prisma.issue.findUniqueOrThrow({ where: { id: issueId }, include: issueInclude });
  }

  async removeCc(orgId: string, projectId: string, issueId: string, ccUserId: string) {
    await this.requireProject(orgId, projectId);
    await this.requireIssue(projectId, issueId);
    await this.prisma.issueCc.deleteMany({ where: { issueId, userId: ccUserId } });
    return this.prisma.issue.findUniqueOrThrow({ where: { id: issueId }, include: issueInclude });
  }
}
