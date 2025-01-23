import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getEnvOrThrow } from '../common/utils/env';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getEnvOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload) {
    const { sub, roles } = payload;

    try {
      const session = await this.authService.validateSession(
        sub,
        payload.accessToken,
      );
      if (!session) {
        throw new UnauthorizedException('Session is invalid or expired');
      }
    } catch (error) {
      throw new UnauthorizedException(error.message || 'Unauthorized');
    }

    return { userId: sub, roles: roles };
  }
}
