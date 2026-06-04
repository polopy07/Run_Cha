import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UpdateRepresentativeDto } from './dto/update-representative.dto';
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
  async getMe(@CurrentUser() user: User) {
    const loaded = await this.usersService.findByIdWithRepresentative(user.id);
    return this.usersService.toResponse(loaded);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/nickname')
  async updateNickname(
    @CurrentUser() user: User,
    @Body() dto: UpdateNicknameDto,
  ) {
    await this.usersService.updateNickname(user.id, dto.nickname);
    const loaded = await this.usersService.findByIdWithRepresentative(user.id);
    return this.usersService.toResponse(loaded);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/representative')
  async setRepresentative(
    @CurrentUser() user: User,
    @Body() dto: UpdateRepresentativeDto,
  ) {
    const updatedUser = await this.usersService.setRepresentative(
      user.id,
      dto.userCharacterId,
    );

    return this.usersService.toResponse(updatedUser);
  }
}
