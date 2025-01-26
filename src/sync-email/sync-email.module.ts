import { Module } from '@nestjs/common';
import { SyncEmailService } from './sync-email.service';
import { SearchModule } from 'src/search/search.module';
import { BullModule } from '@nestjs/bull';
import { EmailSyncProcessor } from './sync-email.processor.service';

@Module({
  imports: [
    SearchModule,
    BullModule.registerQueue({
      name: 'email-sync',
    }),
  ],
  providers: [SyncEmailService, EmailSyncProcessor],
  exports: [SyncEmailService],
})
export class SyncEmailModule {}
