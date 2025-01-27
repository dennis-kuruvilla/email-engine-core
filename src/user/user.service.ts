import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InitialSyncStatus,
  RealTimeSyncStatus,
  User,
  UserEmail,
} from './user.entity';
import { WebSocketGatewayService } from 'src/websocket/websocket.gateway';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(UserEmail)
    private userEmailsRepository: Repository<UserEmail>,
    private webSocketService: WebSocketGatewayService,
  ) {}

  async onModuleInit() {
    console.log('Resetting realtimeSyncStatus for all user emails to INACTIVE');
    await this.userEmailsRepository.update(
      {},
      { realtimeSyncStatus: RealTimeSyncStatus.INACTIVE },
    );
  }

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

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['emails'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userEmails = user.emails.map((email) => ({
      id: email.id,
      email: email.email,
      provider: email.provider,
      realtimeSyncStatus: email.realtimeSyncStatus,
      initialSyncStatus: email.initialSyncStatus,
    }));

    return {
      id: user.id,
      username: user.username,
      emails: userEmails,
    };
  }

  async upsertUserEmail(data: {
    userId: string;
    email: string | null;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    provider: string;
  }) {
    await this.userEmailsRepository.upsert(
      {
        user: { id: data.userId },
        email: data.email,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        provider: data.provider,
      },
      {
        conflictPaths: ['user', 'email'],
      },
    );
  }

  async getUserEmail(userId: string, provider: string) {
    const userEmail = await this.userEmailsRepository.findOne({
      where: { user: { id: userId }, provider },
    });

    if (!userEmail.accessToken) {
      throw new NotFoundException('Token not found');
    }

    return userEmail;
  }

  async updateInitialSyncStatus(
    userId: string,
    email: string,
    status: InitialSyncStatus,
  ): Promise<UserEmail> {
    const userEmail = await this.userEmailsRepository.findOneOrFail({
      where: { user: { id: userId }, email },
      relations: ['user'],
    });

    userEmail.initialSyncStatus = status;

    await this.sendUserMailUpdateEvent(userEmail);

    return this.userEmailsRepository.save(userEmail);
  }

  async updateRealTimeSyncStatus(
    userId: string,
    email: string,
    status: RealTimeSyncStatus,
  ): Promise<UserEmail> {
    const userEmail = await this.userEmailsRepository.findOneOrFail({
      where: { user: { id: userId }, email },
      relations: ['user'],
    });

    userEmail.realtimeSyncStatus = status;

    await this.sendUserMailUpdateEvent(userEmail);

    return this.userEmailsRepository.save(userEmail);
  }

  async sendUserEvent(userId: string, payload: any) {
    this.webSocketService.sendEventToUser(userId, payload);
  }

  async sendUserMailUpdateEvent(userEmail: UserEmail) {
    const payload = {
      type: 'MAILBOX_UPDATE',
      id: userEmail.id,
    };
    this.webSocketService.sendEventToUser(userEmail.user.id, payload);
  }
}
