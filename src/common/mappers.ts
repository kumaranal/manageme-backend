import type {
  ActivityEntry,
  Comment,
  Invite,
  Issue,
  IssueCc,
  Membership,
  Organization,
  Project,
  ProjectMembership,
  Sprint,
  Status,
  StoreItem,
  StoreHistoryEntry,
  Subscription,
  TaskField,
  User,
} from '@prisma/client';

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

type IssueWithRelations = Issue & {
  comments: Comment[];
  activity: ActivityEntry[];
  cc: IssueCc[];
};

export function mapIssue(i: IssueWithRelations) {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
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

type ProjectWithRelations = Project & {
  members: ProjectMembership[];
  taskFields: TaskField[];
  statuses: Status[];
  sprints: Sprint[];
  storeItems: StoreItemWithHistory[];
  issues: IssueWithRelations[];
};

export function mapProject(p: ProjectWithRelations) {
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
    issues: p.issues.map(mapIssue),
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

type OrganizationWithRelations = Organization & {
  members: Membership[];
  invites: Invite[];
  projects: ProjectWithRelations[];
  subscription: Subscription | null;
};

export function mapOrganization(o: OrganizationWithRelations) {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    initial: o.initial,
    status: o.status,
    capacityHoursPerWeek: o.capacityHoursPerWeek,
    members: o.members.map(mapMembership),
    invites: o.invites.map(mapInvite),
    projects: o.projects.map(mapProject),
    subscription: o.subscription ? mapSubscription(o.subscription) : null,
  };
}
