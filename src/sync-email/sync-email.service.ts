import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class SyncEmailService implements OnModuleInit {
  constructor(
    @InjectQueue('email-sync') private readonly emailSyncQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.emailSyncQueue.add('test-job', { test: 'data' });
      console.log('Redis test job added to the queue!');
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
    }
  }

  async queueSyncJob(userId: string, mailId: string, oauthToken: string) {
    await this.emailSyncQueue.add(
      'sync-emails',
      { userId, mailId, oauthToken },
      { removeOnComplete: true },
    );
    console.log(
      `Email sync job added to the queue for user ${userId} email ${mailId}`,
    );
  }

  async queueRealtimeSyncJob(
    userId: string,
    mailId: string,
    oauthToken: string,
  ) {
    await this.emailSyncQueue.add(
      'realtime-sync-emails',
      { userId, mailId, oauthToken },
      { removeOnComplete: true },
    );
    console.log(
      `Real time sync job added to the queue for user ${userId} email ${mailId}`,
    );
  }
}
