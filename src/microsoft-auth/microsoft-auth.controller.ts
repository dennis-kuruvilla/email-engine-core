import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { MicrosoftAuthService } from './microsoft-auth.service';
import { UserService } from 'src/user/user.service';

@Controller('ms-auth')
export class MicrosoftAuthController {
  constructor(
    private readonly microsoftAuthService: MicrosoftAuthService,
    private readonly userService: UserService,
  ) {}

  @Get('login')
  // @UseGuards(JwtAuthGuard)
  //TO-DO accept extract userId from jwt instead of query
  async login(@Query('userId') userId: string, @Res() res) {
    if (!userId) throw new BadRequestException('userId is required');
    const authorizationUrl =
      this.microsoftAuthService.getAuthorizationUrl(userId);
    res.redirect(authorizationUrl);
  }

  @Get('redirect')
  async redirect(@Query('code') code: string, @Query('state') state: string) {
    const userId = this.microsoftAuthService.decodeState(state);

    const token = await this.microsoftAuthService.getTokenFromCode(code);
    const emailResponse = await this.microsoftAuthService.getEmailFromGraph(
      token.access_token,
    );

    await this.userService.saveUserEmail({
      userId,
      email: emailResponse,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      provider: 'microsoft',
    });

    return {
      message: 'Tokens saved successfully',
    };
  }

  @Get('emails')
  async getEmails(@Query('accessToken') accessToken: string) {
    return this.microsoftAuthService.fetchEmails(accessToken);
  }
}
