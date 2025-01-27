import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @UseGuards(JwtAuthGuard)
  @Get('emails')
  async getEmails(
    @Req() req,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const userId = req.user.userId;
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    return this.searchService.searchEmails(userId, pageNum, pageSize);
  }
}
