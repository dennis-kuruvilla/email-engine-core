import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { MicrosoftAuthService } from './microsoft-auth.service';
import { UserService } from 'src/user/user.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SyncEmailService } from 'src/sync-email/sync-email.service';
import { InitialSyncStatus, RealTimeSyncStatus } from 'src/user/user.entity';

@Controller('ms-auth')
export class MicrosoftAuthController {
  constructor(
    private readonly microsoftAuthService: MicrosoftAuthService,
    private readonly userService: UserService,
    private readonly syncEmailService: SyncEmailService,
  ) {}

  @Get('login')
  // @UseGuards(JwtAuthGuard)
  //TO-DO accept extract userId from jwt instead of query
  async login(@Query('userId') userId: string, @Res() res) {
    if (!userId) throw new BadRequestException('userId is required');
    const authorizationUrl =
      await this.microsoftAuthService.getAuthorizationUrl(userId);
    res.redirect(authorizationUrl);
  }

  @Get('redirect')
  async redirect(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res,
  ) {
    const userId = this.microsoftAuthService.decodeState(state);

    const token = await this.microsoftAuthService.getTokenFromCode(code);
    const emailResponse = token.account.username;

    await this.userService.upsertUserEmail({
      userId,
      email: emailResponse,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: null,
      provider: 'microsoft',
    });

    return res.redirect(`http://localhost:5173/email-data?status=linked`);
  }

  @Post('sync-emails')
  @UseGuards(JwtAuthGuard)
  async syncEmails(@Req() req, @Body('force') force: boolean = false) {
    const userEmail = await this.userService.getUserEmail(
      req.user.userId,
      'microsoft',
    );

    if (userEmail.initialSyncStatus === InitialSyncStatus.INITIATED) {
      throw new BadRequestException('Initial sync is already in progress');
    }

    if (userEmail.initialSyncStatus === InitialSyncStatus.PENDING || force) {
      this.syncEmailService.queueSyncJob(
        req.user.userId,
        userEmail.email,
        userEmail.accessToken,
        userEmail.provider,
      );
    } else {
      console.log('skiping initial sync');
    }

    if (userEmail.realtimeSyncStatus === RealTimeSyncStatus.INACTIVE) {
      this.syncEmailService.queueRealtimeSyncJob(
        req.user.userId,
        userEmail.email,
        userEmail.accessToken,
        userEmail.provider,
      );
    } else {
      console.log('skiping realtime sync');
    }
  }

  @Get('emails')
  async getEmails(@Query('accessToken') accessToken: string) {
    return this.microsoftAuthService.fetchEmails(accessToken);
  }
}
