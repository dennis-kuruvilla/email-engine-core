import { Module } from '@nestjs/common';
import { SyncEmailService } from './sync-email.service';

@Module({
  providers: [SyncEmailService],
  exports: [SyncEmailService],
})
export class SyncEmailModule {}
