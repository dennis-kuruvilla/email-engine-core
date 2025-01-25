import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get(':index')
  async search(@Param('index') index: string, @Query('query') query: string) {
    const queryObj = JSON.parse(query);
    return this.searchService.search(index, queryObj);
  }

  @Post(':index')
  async indexDocument(
    @Param('index') index: string,
    @Body() body: { id: string; document: any },
  ) {
    return this.searchService.indexDocument(index, body.id, body.document);
  }
}
