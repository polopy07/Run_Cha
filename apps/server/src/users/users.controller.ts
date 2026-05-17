import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.toResponse(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/nickname')
  async updateNickname(
    @CurrentUser() user: User,
    @Body() dto: UpdateNicknameDto,
  ) {
    const updatedUser = await this.usersService.updateNickname(
      user.id,
      dto.nickname,
    );

    return this.usersService.toResponse(updatedUser);
  }
}
