import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOrCreateUser(firebaseUid: string, email: string) {
    console.log('firebaseUid:', firebaseUid);
    console.log('email:', email);

    let user = await this.usersRepository.findOne({
      where: { firebase_uid: firebaseUid },
    });

    console.log('기존 유저 조회 결과:', user);

    if (!user) {
      console.log('새 유저 생성 시작');

      user = this.usersRepository.create({
        firebase_uid: firebaseUid,
        email,
        nickname: email ? email.split('@')[0] : 'user',
      });

      console.log('생성된 user 객체:', user);

      user = await this.usersRepository.save(user);

      console.log('유저 저장 완료');
    }

    return user;
  }
}