import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  ValidateNested,
  IsObject,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBuildDto {
  @ApiProperty({ description: '平台', example: 'ios', enum: ['ios', 'android'] })
  @IsString()
  @IsNotEmpty({ message: 'platform 不能为空' })
  platform: string;

  @ApiProperty({ description: '渠道', example: 'cn' })
  @IsString()
  @IsNotEmpty({ message: 'flavor 不能为空' })
  flavor: string;

  @ApiProperty({ description: '构建模式', example: 'release', enum: ['debug', 'profile', 'release'] })
  @IsString()
  @IsNotEmpty({ message: 'buildMode 不能为空' })
  buildMode: string;

  @ApiProperty({ description: '环境', example: 'prod', enum: ['dev', 'staging', 'pre', 'prod'] })
  @IsString()
  @IsNotEmpty({ message: 'env 不能为空' })
  env: string;

  @ApiProperty({ description: 'Git 分支', example: 'main' })
  @IsString()
  @IsNotEmpty({ message: 'branch 不能为空' })
  @MinLength(1, { message: 'branch 长度至少为 1' })
  branch: string;

  @ApiPropertyOptional({ description: '语言', example: 'zh' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: '地区', example: 'CN' })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({ description: '蒲公英账号类型', example: 'jianguo' })
  @IsString()
  @IsOptional()
  pgyerAccountType?: string;

  @ApiPropertyOptional({ description: '发布目标平台列表', example: ['pgyer', 'xiaomi'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  publishTargets?: string[];

  @ApiPropertyOptional({ description: '自定义参数', example: { feature_flag: 'v2' } })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  customParams?: Record<string, string>;
}
