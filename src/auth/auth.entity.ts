import { IsString, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(255)
  username: string;

  @IsString()
  @MaxLength(100)
  password: string;
}

export class LoginDto {
  @IsString()
  @MaxLength(255)
  username: string;

  @IsString()
  @MaxLength(100)
  password: string;
}

export class AuthResponseDto {
  @IsString()
  accessToken: string;
}
