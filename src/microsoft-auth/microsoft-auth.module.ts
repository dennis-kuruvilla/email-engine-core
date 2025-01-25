import { Module } from '@nestjs/common';
import { MicrosoftAuthService } from './microsoft-auth.service';
import { MicrosoftAuthController } from './microsoft-auth.controller';
import { UserModule } from 'src/user/user.module';
import { SyncEmailModule } from 'src/sync-email/sync-email.module';

@Module({
  imports: [UserModule, SyncEmailModule],
  controllers: [MicrosoftAuthController],
  providers: [MicrosoftAuthService],
})
export class MicrosoftAuthModule {}
