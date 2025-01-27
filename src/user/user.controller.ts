import { Controller, Get, UseGuards, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from './user.entity';
import { UserService } from './user.service';

@Controller('users')
@ApiBearerAuth()
@ApiTags('User Management')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Partial search by username',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers(@Query('search') search?: string): Promise<User[]> {
    return this.userService.getAllUsers(search);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getLoggedInUser(@Req() req): Promise<User> {
    const userId = req.user.userId;
    return await this.userService.getUserById(userId);
  }
}
