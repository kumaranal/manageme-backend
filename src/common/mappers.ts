import type {
  ActivityEntry,
  Attachment,
  Comment,
  GitConnection,
  Invite,
  Issue,
  IssueBranch,
  IssueCc,
  Membership,
  Organization,
  Project,
  ProjectMembership,
  ProjectRepo,
  Sprint,
  Status,
  StoreItem,
  StoreHistoryEntry,
  Subscription,
  TaskField,
  User,
} from '@prisma/client';
import type { StorageService } from '../storage/storage.service';

// Reshapes Prisma's schema-idiomatic field names (leadId, assigneeId, cc rows, etc.)
// into exactly what the frontend's src/types/index.ts expects.

const dateOnly = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;
const iso = (d: Date): string => d.toISOString();

export function mapUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: u.initials,
    isSuperadmin: u.isSuperadmin,
  };
}

export function mapMembership(m: Membership) {
  return { userId: m.userId, role: m.role };
}

export function mapInvite(i: Invite) {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    at: iso(i.createdAt),
    token: i.token,
  };
}

export function mapProjectMembership(m: ProjectMembership) {
  return { userId: m.userId, role: m.role, weeklyHours: m.weeklyHours };
}

export function mapTaskField(f: TaskField) {
  return {
    id: f.fieldKey,
    label: f.label,
    enabled: f.enabled,
    required: f.required,
  };
}

export function mapStatus(s: Status) {
  return { id: s.id, name: s.name, category: s.category };
}

export function mapSprint(s: Sprint) {
  return {
    id: s.id,
    name: s.name,
    startDate: dateOnly(s.startDate)!,
    endDate: dateOnly(s.endDate)!,
    status: s.status,
  };
}

export function mapComment(c: Comment) {
  return { id: c.id, author: c.authorId, body: c.body, at: iso(c.createdAt) };
}

export function mapActivityEntry(a: ActivityEntry) {
  return { id: a.id, actor: a.actorId, text: a.text, at: iso(a.createdAt) };
}

export async function mapAttachment(a: Attachment, storage: StorageService) {
  return {
    id: a.id,
    filename: a.filename,
    path: a.path,
    url: await storage.getSignedDownloadUrl(a.path),
    size: a.size,
    mimeType: a.mimeType,
    uploadedBy: a.uploadedById,
    createdAt: iso(a.createdAt),
  };
}

export function mapIssueBranch(b: IssueBranch) {
  return {
    id: b.id,
    branchName: b.branchName,
    createdBy: b.createdById,
    prNumber: b.prNumber,
    prState: b.prState,
    prUrl: b.prUrl,
    prTitle: b.prTitle,
    createdAt: iso(b.createdAt),
  };
}

type IssueWithRelations = Issue & {
  comments: Comment[];
  activity: ActivityEntry[];
  attachments: Attachment[];
  cc: IssueCc[];
  branches: IssueBranch[];
};

export async function mapIssue(i: IssueWithRelations, storage: StorageService) {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    description: i.description,
    type: i.type,
    priority: i.priority,
    assignee: i.assigneeId,
    statusId: i.statusId,
    rank: i.rank,
    due: dateOnly(i.due),
    labels: i.labels,
    cc: i.cc.map((c) => c.userId),
    comments: i.comments.map(mapComment),
    estimatedHours: i.estimatedHours,
    sprintId: i.sprintId,
    activity: i.activity.map(mapActivityEntry),
    attachments: await Promise.all(
      i.attachments.map((a) => mapAttachment(a, storage)),
    ),
    branches: i.branches.map(mapIssueBranch),
  };
}

export function mapStoreHistoryEntry(h: StoreHistoryEntry) {
  return { actor: h.actorId, text: h.text, at: iso(h.at) };
}

type StoreItemWithHistory = StoreItem & { history: StoreHistoryEntry[] };

export function mapStoreItem(s: StoreItemWithHistory) {
  return {
    id: s.id,
    title: s.title,
    kind: s.kind,
    content: s.content,
    updatedBy: s.updatedById,
    updatedAt: iso(s.updatedAt),
    history: s.history.map(mapStoreHistoryEntry),
  };
}

export function mapProjectRepo(r: ProjectRepo) {
  return {
    id: r.id,
    repoId: r.repoId,
    repoFullName: r.repoFullName,
    defaultBranch: r.defaultBranch,
    linkedBy: r.linkedById,
  };
}

type ProjectWithRelations = Project & {
  members: ProjectMembership[];
  taskFields: TaskField[];
  statuses: Status[];
  sprints: Sprint[];
  storeItems: StoreItemWithHistory[];
  issues: IssueWithRelations[];
  repo: ProjectRepo | null;
};

export async function mapProject(p: ProjectWithRelations, storage: StorageService) {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    blurb: p.blurb,
    lead: p.leadId,
    counter: p.counter,
    archived: p.archived,
    taskFields: p.taskFields.map(mapTaskField),
    sprints: p.sprints.map(mapSprint),
    sprintConfig: { lengthWeeks: p.sprintLengthWeeks },
    store: p.storeItems.map(mapStoreItem),
    members: p.members.map(mapProjectMembership),
    statuses: p.statuses.map(mapStatus),
    issues: await Promise.all(p.issues.map((i) => mapIssue(i, storage))),
    repo: p.repo ? mapProjectRepo(p.repo) : null,
  };
}

export function mapSubscription(s: Subscription) {
  return {
    planId: s.planId,
    currentPeriodStart: iso(s.currentPeriodStart),
    currentPeriodEnd: iso(s.currentPeriodEnd),
    active: s.currentPeriodEnd.getTime() > Date.now(),
  };
}

export function mapGitConnection(c: GitConnection) {
  return {
    id: c.id,
    accountLogin: c.accountLogin,
    accountType: c.accountType,
    connectedBy: c.connectedById,
    createdAt: iso(c.createdAt),
  };
}

type OrganizationWithRelations = Organization & {
  members: Membership[];
  invites: Invite[];
  projects: ProjectWithRelations[];
  subscription: Subscription | null;
  gitConnection: GitConnection | null;
};

export async function mapOrganization(
  o: OrganizationWithRelations,
  storage: StorageService,
) {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    initial: o.initial,
    status: o.status,
    capacityHoursPerWeek: o.capacityHoursPerWeek,
    members: o.members.map(mapMembership),
    invites: o.invites.map(mapInvite),
    projects: await Promise.all(o.projects.map((p) => mapProject(p, storage))),
    subscription: o.subscription ? mapSubscription(o.subscription) : null,
    gitConnection: o.gitConnection ? mapGitConnection(o.gitConnection) : null,
  };
}
