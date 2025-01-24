import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { datasource } from './common/datasource';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MicrosoftAuthModule } from './microsoft-auth/microsoft-auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(datasource.options),
    AuthModule,
    UserModule,
    MicrosoftAuthModule,
  ],
})
export class AppModule {}
