import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { getEnvOrThrow } from '../common/utils/env';

jest.mock('../common/utils/env', () => ({
  getEnvOrThrow: jest.fn(),
}));

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = {
      validateSession: jest.fn(),
    } as any;

    (getEnvOrThrow as jest.Mock).mockReturnValue('mock-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: AuthService, useValue: authService }],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and return user details for a valid session', async () => {
    const mockPayload = {
      sub: '123',
      roles: ['admin'],
      accessToken: 'mock-token',
    };
    authService.validateSession.mockResolvedValue(true);

    const result = await jwtStrategy.validate(mockPayload);

    expect(authService.validateSession).toHaveBeenCalledWith(
      mockPayload.sub,
      mockPayload.accessToken,
    );
    expect(result).toEqual({
      userId: mockPayload.sub,
      roles: mockPayload.roles,
    });
  });

  it('should throw UnauthorizedException for an invalid session', async () => {
    const mockPayload = {
      sub: '123',
      roles: ['admin'],
      accessToken: 'mock-token',
    };
    authService.validateSession.mockResolvedValue(false);

    await expect(jwtStrategy.validate(mockPayload)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(authService.validateSession).toHaveBeenCalledWith(
      mockPayload.sub,
      mockPayload.accessToken,
    );
  });

  it('should throw UnauthorizedException if validateSession throws an error', async () => {
    const mockPayload = {
      sub: '123',
      roles: ['admin'],
      accessToken: 'mock-token',
    };
    authService.validateSession.mockRejectedValue(
      new Error('Unexpected error'),
    );

    await expect(jwtStrategy.validate(mockPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
