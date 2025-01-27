import {
  Controller,
  Get,
  UseGuards,
  Query,
  Req,
  Post,
  Param,
  Body,
} from '@nestjs/common';
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
  async getLoggedInUser(@Req() req) {
    const userId = req.user.userId;
    return await this.userService.getUserById(userId);
  }

  //just to test websocket connection
  @Post(':userId/sendEvent')
  async sendEvent(@Param('userId') userId: string, @Body() body) {
    await this.userService.sendUserEvent(userId, body);
  }
}
