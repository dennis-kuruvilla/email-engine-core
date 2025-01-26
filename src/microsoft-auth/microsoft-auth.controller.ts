import {
  BadRequestException,
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
  async redirect(@Query('code') code: string, @Query('state') state: string) {
    const userId = this.microsoftAuthService.decodeState(state);

    const token = await this.microsoftAuthService.getTokenFromCode(code);
    // const emailResponse = await this.microsoftAuthService.getEmailFromGraph(
    //   token.accessToken,
    // );
    const emailResponse = token.account.username;
    await this.userService.upsertUserEmail({
      userId,
      email: emailResponse,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: null,
      provider: 'microsoft',
    });

    return {
      message: 'Tokens saved successfully',
    };
  }

  @Post('sync-emails')
  @UseGuards(JwtAuthGuard)
  async syncEmails(@Req() req) {
    const userEmail = await this.userService.getUserEmail(
      req.user.userId,
      'microsoft',
    );
    this.syncEmailService.queueSyncJob(
      req.user.userId,
      userEmail.email,
      userEmail.accessToken,
    );
  }

  @Get('emails')
  async getEmails(@Query('accessToken') accessToken: string) {
    return this.microsoftAuthService.fetchEmails(accessToken);
  }
}
