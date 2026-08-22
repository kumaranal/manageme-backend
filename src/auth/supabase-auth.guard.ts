import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UsersService } from '../users/users.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    this.jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const { payload } = await jwtVerify(token, this.jwks);
      const email = payload.email as string;
      const metadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
      const name = (metadata.name as string) ?? email;

      const user = await this.usersService.ensureUser({
        id: payload.sub as string,
        email,
        name,
      });

      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperadmin: user.isSuperadmin,
      } satisfies AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | undefined {
    const header = request.headers.authorization as string | undefined;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
