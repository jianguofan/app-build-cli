import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OptionValueDto {
  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsNotEmpty()
  label: string;
}

export class CreateOptionGroupDto {
  @IsString()
  @IsNotEmpty({ message: '英文标识不能为空' })
  key: string;

  @IsString()
  @IsNotEmpty({ message: '中文名称不能为空' })
  label: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionValueDto)
  @IsOptional()
  values?: OptionValueDto[];

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class UpdateOptionGroupDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionValueDto)
  @IsOptional()
  values?: OptionValueDto[];

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class AddOptionValueDto {
  @IsString()
  @IsNotEmpty({ message: '选项值不能为空' })
  value: string;

  @IsString()
  @IsNotEmpty({ message: '选项名称不能为空' })
  label: string;
}
