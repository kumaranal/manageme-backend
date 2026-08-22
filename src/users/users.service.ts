import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Called on every authenticated request; cheap upsert keeps our User row
  // in sync with Supabase auth.users (name/email can change there).
  async ensureUser(data: { id: string; email: string; name: string }) {
    return this.prisma.user.upsert({
      where: { id: data.id },
      update: { email: data.email, name: data.name, initials: initialsOf(data.name) },
      create: {
        id: data.id,
        email: data.email,
        name: data.name,
        initials: initialsOf(data.name),
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  // Shared-org membership, not raw id lookup — keeps this from being a cross-tenant directory.
  private sharesOrgWith(requesterId: string) {
    return { memberships: { some: { org: { members: { some: { userId: requesterId } } } } } };
  }

  findByIds(requesterId: string, ids: string[]) {
    return this.prisma.user.findMany({
      where: { id: { in: ids }, ...this.sharesOrgWith(requesterId) },
    });
  }

  search(requesterId: string, query: string) {
    return this.prisma.user.findMany({
      where: {
        ...this.sharesOrgWith(requesterId),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
  }
}
