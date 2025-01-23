import {
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Repository } from 'typeorm';
import { LoginDto, RegisterDto } from './auth.entity';
import { JwtService } from '@nestjs/jwt';
import { Session } from './session.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Session) private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, password } = registerDto;

    const existingUser = await this.userRepository.findOneBy({ username });
    if (existingUser) throw new HttpException('User already exists', 400);

    const user = new User();
    user.username = username;
    user.password = password;

    return this.userRepository.save(user);
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;
    const user = await this.userRepository.findOne({
      where: { username },
      select: ['id', 'password'],
    });

    if (!user || !(await user.validatePassword(password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
    };
    const token = this.jwtService.sign(payload);

    const session = new Session();
    session.userId = user.id;
    session.token = token;
    session.status = 'active';
    await this.sessionRepository.save(session);

    return { accessToken: token };
  }

  async logout(userId: string, token: string) {
    const session = await this.sessionRepository.findOne({
      where: { userId, token, status: 'active' },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    await this.sessionRepository.remove(session);

    return { message: 'Logged out successfully' };
  }

  async validateSession(userId: string, token: string) {
    const session = await this.sessionRepository.findOne({
      where: { userId, token, status: 'active' },
    });

    return !!session;
  }
}
