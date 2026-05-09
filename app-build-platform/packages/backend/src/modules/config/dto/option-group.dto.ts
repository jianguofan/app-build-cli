import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OptionValueDto {
  @ApiProperty({ description: '选项值', example: 'debug' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ description: '选项显示名', example: 'Debug' })
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class CreateOptionGroupDto {
  @ApiProperty({ description: '英文标识', example: 'feature_flag' })
  @IsString()
  @IsNotEmpty({ message: '英文标识不能为空' })
  key: string;

  @ApiProperty({ description: '中文名称', example: '特性开关' })
  @IsString()
  @IsNotEmpty({ message: '中文名称不能为空' })
  label: string;

  @ApiPropertyOptional({ description: '可选值列表', type: [OptionValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionValueDto)
  @IsOptional()
  values?: OptionValueDto[];

  @ApiPropertyOptional({ description: '是否必填', default: false })
  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class UpdateOptionGroupDto {
  @ApiPropertyOptional({ description: '中文名称', example: '特性开关' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ description: '可选值列表', type: [OptionValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionValueDto)
  @IsOptional()
  values?: OptionValueDto[];

  @ApiPropertyOptional({ description: '是否必填', default: false })
  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class AddOptionValueDto {
  @ApiProperty({ description: '选项值', example: 'v2' })
  @IsString()
  @IsNotEmpty({ message: '选项值不能为空' })
  value: string;

  @ApiProperty({ description: '选项名称', example: 'V2 版本' })
  @IsString()
  @IsNotEmpty({ message: '选项名称不能为空' })
  label: string;
}
