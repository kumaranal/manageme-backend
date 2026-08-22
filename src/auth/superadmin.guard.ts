import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from './supabase-auth.guard';

// Runs after the global SupabaseAuthGuard (registered via APP_GUARD), which
// always populates request.user first.
@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.isSuperadmin)
      throw new ForbiddenException('Requires superadmin');
    return true;
  }
}
