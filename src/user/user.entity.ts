import defaultEncryptTransformer from '../common/transformers/encrypt.transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
  JoinColumn,
} from 'typeorm';
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

  @OneToMany(() => UserEmail, (userEmail) => userEmail.user)
  emails: UserEmail[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  async validatePassword(password: string): Promise<boolean> {
    return password === this.password;
  }
}

@Entity('user_emails')
@Unique(['user', 'email'])
export class UserEmail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.emails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'text', nullable: true })
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt: Date;

  @Column({ type: 'text', nullable: true })
  provider: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
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
