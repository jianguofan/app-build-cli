import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { PublishService } from './publish.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('publishes')
@UseGuards(JwtAuthGuard)
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get('build/:buildId')
  getPublishesByBuild(@Param('buildId') buildId: string) {
    return this.publishService.getPublishes(buildId);
  }

  @Get()
  getAllPublishes(
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publishService.getAllPublishes({
      platform,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('build/:buildId/republish')
  async republish(
    @Param('buildId') buildId: string,
    @Body() body: { platforms: string[] },
  ) {
    return this.publishService.republish(buildId, body.platforms);
  }
}
