import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { mapUser } from '../common/mappers';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return mapUser(await this.usersService.findById(user.id));
  }

  // Scoped to people the caller shares an org with — never a platform-wide directory.
  @Get()
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('query') query?: string,
    @Query('ids') ids?: string,
  ) {
    if (ids) {
      const users = await this.usersService.findByIds(
        user.id,
        ids.split(',').filter(Boolean),
      );
      return users.map(mapUser);
    }
    const users = await this.usersService.search(user.id, query ?? '');
    return users.map(mapUser);
  }
}
