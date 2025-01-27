import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { datasource } from './common/datasource';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MicrosoftAuthModule } from './microsoft-auth/microsoft-auth.module';
import { SearchModule } from './search/search.module';
import { SyncEmailModule } from './sync-email/sync-email.module';
import { BullModule } from '@nestjs/bull';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(datasource.options),
    AuthModule,
    UserModule,
    MicrosoftAuthModule,
    SearchModule,
    SyncEmailModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    WebsocketModule,
  ],
})
export class AppModule {}
