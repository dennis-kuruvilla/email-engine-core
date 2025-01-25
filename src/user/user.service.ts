import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserEmail } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(UserEmail)
    private userEmailsRepository: Repository<UserEmail>,
  ) {}

  async getAllUsers(search?: string): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.emails', 'emails');

    if (search) {
      query.where('LOWER(user.email) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    return query.getMany();
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['emails'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async saveUserEmail(data: {
    userId: string;
    email: string | null;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    provider: string;
  }) {
    const userEmail = this.userEmailsRepository.create({
      user: { id: data.userId },
      email: data.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      provider: data.provider,
    });

    await this.userEmailsRepository.save(userEmail);
  }

  async getToken(userId: string, provider: string) {
    const userEmail = await this.userEmailsRepository.findOne({
      where: { user: { id: userId }, provider },
    });

    if (!userEmail.accessToken) {
      throw new NotFoundException('Token not found');
    }

    return userEmail.accessToken;
  }
}
