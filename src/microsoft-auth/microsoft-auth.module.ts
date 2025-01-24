import { Module } from '@nestjs/common';
import { MicrosoftAuthService } from './microsoft-auth.service';
import { MicrosoftAuthController } from './microsoft-auth.controller';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [MicrosoftAuthController],
  providers: [MicrosoftAuthService],
})
export class MicrosoftAuthModule {}
