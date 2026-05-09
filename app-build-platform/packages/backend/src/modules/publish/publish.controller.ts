import { Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus, NotFoundException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { PublishService } from './publish.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('publishes')
@ApiBearerAuth()
@Controller('publishes')
@UseGuards(JwtAuthGuard)
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get('build/:buildId')
  @ApiOperation({ summary: '获取构建的发布记录', description: '返回指定构建任务的所有发布记录' })
  @ApiParam({ name: 'buildId', description: '构建任务 ID' })
  getPublishesByBuild(@Param('buildId') buildId: string) {
    return this.publishService.getPublishes(buildId);
  }

  @Get()
  @ApiOperation({ summary: '获取发布列表', description: '分页获取所有发布记录' })
  @ApiQuery({ name: 'platform', required: false, description: '按平台过滤' })
  @ApiQuery({ name: 'status', required: false, description: '按状态过滤', enum: ['pending', 'uploading', 'success', 'failed', 'reviewing'] })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量', example: '20' })
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
  @ApiOperation({ summary: '重新发布', description: '手动触发发布到指定平台（不检查构建状态，只要有产物即可）' })
  @ApiParam({ name: 'buildId', description: '构建任务 ID' })
  @ApiBody({ schema: { type: 'object', properties: { platforms: { type: 'array', items: { type: 'string' }, description: '目标平台列表' } } } })
  @ApiResponse({ status: 201, description: '发布任务已创建' })
  async republish(
    @Param('buildId') buildId: string,
    @Body() body: { platforms: string[] },
  ) {
    return this.publishService.republish(buildId, body.platforms);
  }

  @Post('upload/:buildId/:platform')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '直接上传', description: '跳过构建状态检查，直接上传产物到指定平台（调试用）' })
  @ApiParam({ name: 'buildId', description: '构建任务 ID' })
  @ApiParam({ name: 'platform', description: '目标平台', enum: ['appstore', 'appstore_over', 'pgyer', 'xiaomi', 'huawei', 'oppo', 'vivo', 'tencent', 'qihu360', 'honor', 'samsung'] })
  @ApiResponse({ status: 200, description: '上传任务已创建' })
  async directUpload(
    @Param('buildId') buildId: string,
    @Param('platform') platform: string,
  ) {
    return this.publishService.directUpload(buildId, platform);
  }

  @Post(':publishId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重试发布', description: '重新执行失败的发布任务' })
  @ApiParam({ name: 'publishId', description: '发布记录 ID' })
  @ApiResponse({ status: 200, description: '重试任务已创建' })
  async retryPublish(@Param('publishId') publishId: string) {
    return this.publishService.retryPublish(publishId);
  }

  @Post('upload-file/:platform')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR || '/tmp/app-build-uploads';
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.ipa' || ext === '.apk') {
          cb(null, true);
        } else {
          cb(new Error('只支持 .ipa 或 .apk 文件'), false);
        }
      },
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB
      },
    }),
  )
  @ApiOperation({ summary: '上传文件并发布', description: '直接上传 IPA/APK 文件到指定平台' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'platform', description: '目标平台', enum: ['appstore', 'appstore_over', 'pgyer', 'xiaomi', 'huawei', 'oppo', 'vivo', 'tencent', 'qihu360', 'honor', 'samsung'] })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'IPA 或 APK 文件',
        },
        releaseNotes: {
          type: 'string',
          description: '此版本的新增内容（更新日志）',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '上传任务已创建' })
  async uploadFile(
    @Param('platform') platform: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('releaseNotes') releaseNotes?: string,
  ) {
    if (!file) {
      throw new Error('请上传文件');
    }

    return this.publishService.uploadFile(file.path, platform, releaseNotes);
  }
}
