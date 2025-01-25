import { Module } from '@nestjs/common';
import { SyncEmailService } from './sync-email.service';
import { SearchModule } from 'src/search/search.module';

@Module({
  imports: [SearchModule],
  providers: [SyncEmailService],
  exports: [SyncEmailService],
})
export class SyncEmailModule {}
