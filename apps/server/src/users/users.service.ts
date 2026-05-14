import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOrCreateUser(
    firebaseUid: string,
    email: string,
    displayName?: string,
  ) {
    let user = await this.usersRepository.findOne({
      where: { firebase_uid: firebaseUid },
    });

    if (user) {
      return user;
    }

    if (email) {
      user = await this.usersRepository.findOne({
        where: { email },
      });

      if (user) {
        user.firebase_uid = firebaseUid;
        return this.usersRepository.save(user);
      }
    }

    if (!user) {
      user = this.usersRepository.create({
        firebase_uid: firebaseUid,
        email,
        nickname: displayName || (email ? email.split('@')[0] : 'user'),
      });

      user = await this.usersRepository.save(user);
    }

    return user;
  }

  async findById(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  async updateNickname(id: number, nickname: string) {
    const user = await this.findById(id);
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname || trimmedNickname.length > 50) {
      throw new BadRequestException(
        '닉네임은 1자 이상 50자 이하로 입력해야 합니다.',
      );
    }

    user.nickname = trimmedNickname;

    return this.usersRepository.save(user);
  }

  toResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      points: user.points,
      totalDistance: user.total_distance,
      pityCount: user.pity_count,
    };
  }
}
