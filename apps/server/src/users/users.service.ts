import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  Character,
  CharacterGrade,
  CharacterType,
} from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { User } from './entities/user.entity';

const STARTER_CHARACTER_TYPES = [
  CharacterType.ATTACK,
  CharacterType.DEFENSE,
  CharacterType.BUFF,
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findOrCreateUser(
    firebaseUid: string,
    email: string,
    displayName?: string,
  ) {
    const existingUserByUid = await this.usersRepository.findOne({
      where: { firebase_uid: firebaseUid },
    });

    if (existingUserByUid) {
      return existingUserByUid;
    }

    const existingUserByEmail = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUserByEmail) {
      return this.dataSource.transaction(async (manager) => {
        const usersRepository = manager.getRepository(User);
        const previousFirebaseUid = existingUserByEmail.firebase_uid;
        const user = await usersRepository.findOne({
          where: { email },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user) {
          throw new NotFoundException('User not found.');
        }

        if (user.firebase_uid !== previousFirebaseUid) {
          return user;
        }

        user.firebase_uid = firebaseUid;
        return usersRepository.save(user);
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const usersRepository = manager.getRepository(User);

      const user = usersRepository.create({
        firebase_uid: firebaseUid,
        email,
        nickname: displayName || email.split('@')[0],
      });

      const savedUser = await usersRepository.save(user);
      await this.grantStarterCharacter(savedUser.id, manager);

      return savedUser;
    });
  }

  private async grantStarterCharacter(userId: number, manager: EntityManager) {
    const charactersRepository = manager.getRepository(Character);
    const userCharactersRepository = manager.getRepository(UserCharacter);

    const starterCharacters = await charactersRepository.find({
      where: {
        grade: CharacterGrade.COMMON,
        type: In(STARTER_CHARACTER_TYPES),
      },
    });

    if (starterCharacters.length === 0) {
      return;
    }

    const selectedCharacter =
      starterCharacters[Math.floor(Math.random() * starterCharacters.length)];

    const userCharacter = userCharactersRepository.create({
      user_id: userId,
      character_id: selectedCharacter.id,
    });

    await userCharactersRepository.save(userCharacter);
  }

  async findById(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  async findByIdWithRepresentativeCharacter(id: number): Promise<{
    id: number;
    nickname: string;
    character: {
      name: string;
      type: string;
      grade: string;
      imageUrl: string | null;
    } | null;
  }> {
    const rows = await this.dataSource.query<
      Array<{
        id: number;
        nickname: string;
        c_name: string | null;
        c_type: string | null;
        c_grade: string | null;
        c_image_url: string | null;
      }>
    >(
      `SELECT u.id, u.nickname,
              c.name  AS c_name,
              c.type  AS c_type,
              c.grade AS c_grade,
              c.image_url AS c_image_url
       FROM users u
       LEFT JOIN user_characters uc ON uc.id = u.representative_character_id
       LEFT JOIN characters c ON c.id = uc.character_id
       WHERE u.id = ?`,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const row = rows[0];
    return {
      id: row.id,
      nickname: row.nickname,
      character: row.c_name
        ? {
            name: row.c_name,
            type: row.c_type!,
            grade: row.c_grade!,
            imageUrl: row.c_image_url,
          }
        : null,
    };
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
      statPoints: user.stat_points,
      totalDistance: user.total_distance,
    };
  }
}
