import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { BuildService } from './build.service';
import { CreateBuildDto } from './dto/create-build.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('builds')
@ApiBearerAuth()
@Controller('builds')
@UseGuards(JwtAuthGuard)
export class BuildController {
  constructor(private readonly buildService: BuildService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建构建任务', description: '提交一个新的 App 构建任务' })
  @ApiBody({ type: CreateBuildDto })
  @ApiResponse({ status: 201, description: '构建任务创建成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  create(@Body() createBuildDto: CreateBuildDto) {
    return this.buildService.create(createBuildDto);
  }

  @Post(':id/rebuild')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '重新构建', description: '基于已有任务重新执行构建（更新代码）' })
  @ApiParam({ name: 'id', description: '构建任务 ID' })
  @ApiResponse({ status: 201, description: '重新构建任务已创建' })
  rebuild(@Param('id') id: string) {
    return this.buildService.rebuild(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消构建', description: '取消正在进行或等待中的构建任务' })
  @ApiParam({ name: 'id', description: '构建任务 ID' })
  @ApiResponse({ status: 200, description: '取消成功' })
  @ApiResponse({ status: 400, description: '任务状态不允许取消' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  cancel(@Param('id') id: string) {
    return this.buildService.cancel(id);
  }

  @Get()
  @ApiOperation({ summary: '获取构建列表', description: '分页获取所有构建任务' })
  @ApiQuery({ name: 'status', required: false, description: '按状态过滤', enum: ['pending', 'running', 'success', 'failed', 'cancelled'] })
  @ApiQuery({ name: 'platform', required: false, description: '按平台过滤', enum: ['ios', 'android'] })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量', example: '20' })
  @ApiResponse({ status: 200, description: '返回构建列表' })
  findAll(
    @Query('status') status?: string,
    @Query('platform') platform?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.buildService.findAll({
      status,
      platform,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: '获取构建统计', description: '返回构建总数、成功率、运行中任务数、平均耗时等统计信息' })
  @ApiResponse({ status: 200, description: '返回统计信息' })
  getStats() {
    return this.buildService.getStats();
  }

  @Get('recent')
  @ApiOperation({ summary: '获取最近构建', description: '返回最近 10 条构建记录' })
  @ApiResponse({ status: 200, description: '返回最近构建记录' })
  getRecentBuilds() {
    return this.buildService.getRecentBuilds();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取构建详情', description: '根据 ID 获取单个构建任务详情' })
  @ApiParam({ name: 'id', description: '构建任务 ID' })
  @ApiResponse({ status: 200, description: '返回构建任务详情' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  findOne(@Param('id') id: string) {
    return this.buildService.findOne(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: '获取构建日志', description: '获取指定构建任务的日志内容' })
  @ApiParam({ name: 'id', description: '构建任务 ID' })
  @ApiResponse({ status: 200, description: '返回日志内容' })
  getLogs(@Param('id') id: string) {
    return this.buildService.getLogs(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载构建产物', description: '下载构建产出的 IPA/APK 文件' })
  @ApiParam({ name: 'id', description: '构建任务 ID' })
  @ApiResponse({ status: 200, description: '返回文件流' })
  @ApiResponse({ status: 404, description: '产物不存在' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const task = await this.buildService.findOne(id);
    const artifacts = task.artifacts as Record<string, string> | undefined;

    if (!artifacts) {
      throw new NotFoundException('No artifacts available');
    }

    const filePath = artifacts.ipa || artifacts.apk;
    if (!filePath) {
      throw new NotFoundException('No artifacts available');
    }

    // Check file exists before attempting download to avoid ERR_HTTP_HEADERS_SENT
    const fs = await import('fs');
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Artifact file not found: ${filePath}`);
    }

    const fileName = filePath.split('/').pop() || `${id}`;
    const ext = task.platform === 'ios' ? '.ipa' : '.apk';
    const downloadName = `${task.platform}-${task.flavor}-${task.buildMode}-${task.env}-${task.id.substring(0, 8)}${ext}`;

    res.download(filePath, downloadName);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除构建任务', description: '删除指定的构建任务' })
  @ApiParam({ name: 'id', description: '构建任务 ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  delete(@Param('id') id: string) {
    return this.buildService.delete(id);
  }
}
