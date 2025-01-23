import defaultEncryptTransformer from '../common/transformers/encrypt.transformer';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { IsString, IsEmail, MaxLength } from 'class-validator';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({
    type: 'bytea',
    transformer: defaultEncryptTransformer,
    nullable: true,
    select: false,
  })
  password: string | null;

  async validatePassword(password: string): Promise<boolean> {
    return password === this.password;
  }
}

export class UserDto {
  @IsString()
  id: string;

  @IsEmail()
  @MaxLength(255)
  username: string;

  @IsString()
  @MaxLength(100)
  password: string;
}
